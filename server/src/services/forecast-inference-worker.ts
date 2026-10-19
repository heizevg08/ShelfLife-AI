import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { createInterface, type Interface as ReadLineInterface } from 'node:readline';
import type { Config } from '../config/env';

const REPO_ROOT = resolve(__dirname, '../../..');

function resolveWorkerPath(target: string): string {
  if (isAbsolute(target)) return target;
  const fromCwd = resolve(target);
  if (existsSync(fromCwd)) return fromCwd;
  const fromRepo = resolve(REPO_ROOT, target);
  return existsSync(fromRepo) ? fromRepo : fromCwd;
}

function resolvePythonExecutable(executable: string): string {
  if (!executable.includes('/') && !executable.includes('\\')) return executable;
  return resolveWorkerPath(executable);
}

export interface ForecastHistoryRow {
  dt: string;
  sale_amount: number;
}

export interface ForecastPrediction {
  date: string;
  predictedConsumption: number;
}

export interface ForecastInferenceRequest {
  history: ForecastHistoryRow[];
  forecastDates: string[];
}

export interface ForecastInferenceWorker {
  start(): Promise<void>;
  infer(request: ForecastInferenceRequest): Promise<ForecastPrediction[]>;
  stop(): Promise<void>;
}

interface ReadyMessage {
  type: 'ready';
  ok: true;
}

interface SuccessMessage {
  requestId: string;
  ok: true;
  predictions: ForecastPrediction[];
}

interface ErrorMessage {
  requestId: string | null;
  ok: false;
  error: {
    type: string;
    message: string;
  };
}

type WorkerResponse = SuccessMessage | ErrorMessage;

interface PendingRequest {
  requestId: string;
  resolve: (predictions: ForecastPrediction[]) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const STDERR_LIMIT = 4096;
const STOP_GRACE_MS = 1000;

function asError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReadyMessage(value: unknown): value is ReadyMessage {
  return isRecord(value) && value.type === 'ready' && value.ok === true;
}

function parseWorkerResponse(value: unknown): WorkerResponse {
  if (!isRecord(value) || typeof value.requestId !== 'string' || typeof value.ok !== 'boolean') {
    throw new Error('Forecast worker returned a malformed response.');
  }

  if (value.ok === true) {
    if (!Array.isArray(value.predictions)) {
      throw new Error('Forecast worker returned a malformed success response.');
    }

    const predictions = value.predictions.map((item): ForecastPrediction => {
      if (
        !isRecord(item)
        || typeof item.date !== 'string'
        || typeof item.predictedConsumption !== 'number'
        || !Number.isFinite(item.predictedConsumption)
      ) {
        throw new Error('Forecast worker returned a malformed prediction.');
      }
      return {
        date: item.date,
        predictedConsumption: item.predictedConsumption,
      };
    });

    return {
      requestId: value.requestId,
      ok: true,
      predictions,
    };
  }

  if (
    !isRecord(value.error)
    || typeof value.error.type !== 'string'
    || typeof value.error.message !== 'string'
  ) {
    throw new Error('Forecast worker returned a malformed error response.');
  }

  return {
    requestId: value.requestId,
    ok: false,
    error: {
      type: value.error.type,
      message: value.error.message,
    },
  };
}

export function createForecastInferenceWorker(
  config: Pick<
    Config,
    'mlPythonExecutable' | 'mlWorkerScript' | 'mlStartupTimeoutMs' | 'mlInferenceTimeoutMs'
  >,
): ForecastInferenceWorker {
  let child: ChildProcessWithoutNullStreams | undefined;
  let lines: ReadLineInterface | undefined;
  let starting: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  let ready = false;
  let pending: PendingRequest | undefined;
  let serialized: Promise<void> = Promise.resolve();
  let stderr = '';

  const pythonExecutable = resolvePythonExecutable(config.mlPythonExecutable);
  const workerScript = resolveWorkerPath(config.mlWorkerScript);
  const workerCwd = dirname(dirname(workerScript));

  const rememberStderr = (chunk: Buffer | string) => {
    stderr = (stderr + chunk.toString()).slice(-STDERR_LIMIT);
  };

  const diagnosticSuffix = () => {
    const message = stderr.trim();
    return message ? ` Worker stderr: ${message}` : '';
  };

  const rejectPending = (error: Error) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    const current = pending;
    pending = undefined;
    current.reject(error);
  };

  const clearProcessState = () => {
    lines?.close();
    lines = undefined;
    child = undefined;
    ready = false;
  };

  const handleProtocolLine = (line: string) => {
    let value: unknown;
    try {
      value = JSON.parse(line.replace(/^\uFEFF/, ''));
    } catch {
      const error = new Error('Forecast worker emitted malformed JSON.');
      rejectPending(error);
      child?.kill();
      return;
    }

    if (!ready) {
      if (!isReadyMessage(value)) {
        const error = new Error('Forecast worker did not emit the expected READY message.');
        rejectPending(error);
        child?.kill();
        return;
      }
      ready = true;
      return;
    }

    let response: WorkerResponse;
    try {
      response = parseWorkerResponse(value);
    } catch (error) {
      rejectPending(asError(error, 'Forecast worker protocol failure.'));
      child?.kill();
      return;
    }

    if (!pending) {
      child?.kill();
      return;
    }

    if (response.requestId !== pending.requestId) {
      const error = new Error('Forecast worker response requestId did not match the active request.');
      rejectPending(error);
      child?.kill();
      return;
    }

    clearTimeout(pending.timer);
    const current = pending;
    pending = undefined;

    if (response.ok) {
      current.resolve(response.predictions);
      return;
    }

    current.reject(
      new Error(`Forecast worker ${response.error.type}: ${response.error.message}`),
    );
  };

  const start = (): Promise<void> => {
    if (ready && child) return Promise.resolve();
    if (starting) return starting;
    if (stopping) return Promise.reject(new Error('Forecast worker is stopping.'));

    starting = new Promise<void>((resolveStart, rejectStart) => {
      stderr = '';
      let settled = false;
      const process = spawn(
        pythonExecutable,
        [workerScript],
        {
          cwd: workerCwd,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      child = process;
      lines = createInterface({ input: process.stdout, crlfDelay: Infinity });

      const startupTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        process.kill();
        rejectStart(
          new Error(`Forecast worker startup timed out after ${config.mlStartupTimeoutMs} ms.${diagnosticSuffix()}`),
        );
      }, config.mlStartupTimeoutMs);

      const finishStartupFailure = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(startupTimer);
        rejectStart(error);
      };

      process.stderr.on('data', rememberStderr);

      process.once('error', error => {
        finishStartupFailure(
          new Error(`Forecast worker failed to start.${diagnosticSuffix()} Cause: ${error.message}`),
        );
        rejectPending(error);
        clearProcessState();
      });

      process.once('exit', (code, signal) => {
        const error = new Error(
          `Forecast worker exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'}).${diagnosticSuffix()}`,
        );
        finishStartupFailure(error);
        rejectPending(error);
        clearProcessState();
      });

      lines.on('line', line => {
        if (!line.trim()) return;

        if (!ready) {
          let value: unknown;
          try {
            value = JSON.parse(line.replace(/^\uFEFF/, ''));
          } catch {
            finishStartupFailure(new Error('Forecast worker emitted malformed startup JSON.'));
            process.kill();
            return;
          }

          if (!isReadyMessage(value)) {
            finishStartupFailure(new Error('Forecast worker did not emit the expected READY message.'));
            process.kill();
            return;
          }

          ready = true;
          if (!settled) {
            settled = true;
            clearTimeout(startupTimer);
            resolveStart();
          }
          return;
        }

        handleProtocolLine(line);
      });
    }).finally(() => {
      starting = undefined;
    });

    return starting;
  };

  const runInference = async (
    request: ForecastInferenceRequest,
  ): Promise<ForecastPrediction[]> => {
    await start();

    const process = child;
    if (!process || !ready || process.killed || !process.stdin.writable) {
      throw new Error('Forecast worker is not available.');
    }
    if (pending) {
      throw new Error('Forecast worker already has an active inference request.');
    }

    const requestId = randomUUID();

    return new Promise<ForecastPrediction[]>((resolveRequest, rejectRequest) => {
      const timer = setTimeout(() => {
        if (!pending || pending.requestId !== requestId) return;
        pending = undefined;
        rejectRequest(
          new Error(`Forecast worker inference timed out after ${config.mlInferenceTimeoutMs} ms.`),
        );
        process.kill();
      }, config.mlInferenceTimeoutMs);

      pending = {
        requestId,
        resolve: resolveRequest,
        reject: rejectRequest,
        timer,
      };

      const payload = JSON.stringify({
        requestId,
        history: request.history,
        forecastDates: request.forecastDates,
      });

      process.stdin.write(`${payload}\n`, error => {
        if (!error || !pending || pending.requestId !== requestId) return;
        clearTimeout(timer);
        pending = undefined;
        rejectRequest(new Error(`Unable to write to forecast worker: ${error.message}`));
      });
    });
  };

  const infer = (request: ForecastInferenceRequest): Promise<ForecastPrediction[]> => {
    const operation = serialized.then(() => runInference(request));
    serialized = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };

  const stop = (): Promise<void> => {
    if (stopping) return stopping;

    stopping = (async () => {
      if (starting) {
        try { await starting; } catch { /* startup failure is already surfaced to its caller */ }
      }

      const process = child;
      if (!process) return;

      rejectPending(new Error('Forecast worker stopped before inference completed.'));

      await new Promise<void>(resolveStop => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolveStop();
        };
        const timer = setTimeout(() => {
          if (!process.killed) process.kill();
          finish();
        }, STOP_GRACE_MS);

        process.once('exit', finish);
        process.once('error', finish);

        if (process.stdin.writable) {
          process.stdin.end();
        } else {
          process.kill();
        }
      });

      clearProcessState();
    })().finally(() => {
      stopping = undefined;
    });

    return stopping;
  };

  return { start, infer, stop };
}
