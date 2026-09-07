import { createServer } from 'node:http';
import type { EventEmitter } from 'node:events';
import { createApp } from './app';
import { createDatabase, type Database } from './config/database';
import { readConfig, type Config } from './config/env';
import { Mongoose } from 'mongoose';
import { readJwtSecret } from './config/auth';
import { userModel } from './models/user';
import { createAuth, type AuthService } from './services/auth';

type StartupStage = 'configuration' | 'database-connection' | 'application-composition' | 'http-listen' | 'shutdown-registration';
const safeNames = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'MongoParseError', 'MongoServerError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoServerSelectionError', 'MongooseServerSelectionError']);
const safeCodes = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEOUT', 'ETIMEDOUT', 'ESERVFAIL', 'ENODATA', 'ECONNRESET', 'EAI_AGAIN', 'EADDRINUSE', 'EADDRNOTAVAIL', 'EACCES', 'ERR_INVALID_ARG_TYPE', 'ERR_INVALID_ARG_VALUE']);

// Allowlist metadata rather than redacting arbitrary driver messages or stacks.
export function startupDiagnostic(stage: StartupStage, error: unknown) {
  const value = error instanceof Error ? error as Error & { code?: unknown } : undefined;
  const name = value && safeNames.has(value.name) ? value.name : 'UnknownError';
  const code = typeof value?.code === 'string' && safeCodes.has(value.code) ? value.code
    : value?.code === 18 ? 'AUTHENTICATION_FAILED' : undefined;
  const message = stage === 'configuration' && value &&
    /^Invalid configuration: (?:NODE_ENV|HOST|PORT|MONGO_URI|CORS_ORIGINS|JWT_SECRET)(?:, (?:NODE_ENV|HOST|PORT|MONGO_URI|CORS_ORIGINS|JWT_SECRET))*$/.test(value.message)
    ? value.message : undefined;
  return { stage, name, ...(code ? { code } : {}), ...(message ? { message } : {}) };
}

class StartupFailure extends Error {
  readonly diagnostic: ReturnType<typeof startupDiagnostic>;
  constructor(stage: StartupStage, error: unknown) {
    super('Backend startup failed');
    this.diagnostic = startupDiagnostic(stage, error);
  }
}

async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Operation timed out')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export async function startServer(config: Config, database: Database, shutdownTimeout = 5000, auth?: AuthService, onStage: (stage: StartupStage) => void = () => {}) {
  let stage: StartupStage = 'application-composition';
  onStage(stage);
  let stopping = false;
  const http = createServer(createApp(config.corsOrigins, () => !stopping && database.isConnected(), auth));
  let shutdown: Promise<number> | undefined;
  const stop = (): Promise<number> => {
    if (shutdown) return shutdown;
    stopping = true;
    shutdown = (async () => {
      let exitCode = 0;
      try {
        await bounded(new Promise<void>((resolve, reject) => {
          if (!http.listening) { resolve(); return; }
          http.close(error => error ? reject(error) : resolve());
        }), shutdownTimeout);
      } catch { exitCode = 1; http.closeAllConnections(); }
      try { await bounded(database.disconnect(), shutdownTimeout); }
      catch { exitCode = 1; }
      return exitCode;
    })();
    return shutdown;
  };
  try {
    stage = 'database-connection'; onStage(stage);
    await database.connect(config.mongoUri);
    stage = 'http-listen'; onStage(stage);
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(config.port, config.host, () => { http.off('error', reject); resolve(); });
    });
  } catch (error) {
    await stop();
    throw new StartupFailure(stage, error);
  }
  return { http, stop };
}

export function registerShutdown(signals: EventEmitter, stop: () => Promise<number>, exit: (code: number) => void) {
  let started = false;
  const shutdown = () => {
    if (started) return;
    started = true;
    void stop().then(exit, () => exit(1));
  };
  signals.on('SIGINT', shutdown);
  signals.on('SIGTERM', shutdown);
  return () => { signals.off('SIGINT', shutdown); signals.off('SIGTERM', shutdown); };
}

// Importing this module is safe: only the executable entry point starts I/O.
if (require.main === module) {
  let stage: StartupStage = 'configuration';
  const onStage = (next: StartupStage) => { stage = next; };
  void (async () => {
    onStage('configuration');
    const config = readConfig(process.env);
    const secret = readJwtSecret(process.env);
    onStage('application-composition');
    const driver = new Mongoose();
    const users = userModel(driver);
    const auth = createAuth({
      byEmail: email => users.findOne({ email }).select('+passwordHash').lean().exec(),
      byId: id => users.findById(id).lean().exec(),
    }, secret);
    const runtime = await startServer(config, createDatabase(driver), 5000, auth, onStage);
    onStage('shutdown-registration');
    registerShutdown(process, runtime.stop, code => process.exit(code));
    console.info('Backend listening');
  })().catch(error => {
    console.error('Backend startup failed', error instanceof StartupFailure ? error.diagnostic : startupDiagnostic(stage, error));
    process.exit(1);
  });
}
