import { isIP } from 'node:net';

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  mongoUri: string;
  corsOrigins: string[];
  trustProxy: boolean;
  cookieSameSite: 'lax' | 'none';
  mlPythonExecutable: string;
  mlWorkerScript: string;
  mlStartupTimeoutMs: number;
  mlInferenceTimeoutMs: number;
}

// Validation errors contain field names only, never supplied values.
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const invalid = new Set<string>();
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) invalid.add('NODE_ENV');
  const host = env.HOST ?? '127.0.0.1';
  if (!isIP(host) && !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(host)) invalid.add('HOST');
  const rawPort = env.PORT ?? '5000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) invalid.add('PORT');
  const mongoUri = env.MONGO_URI?.trim() ?? '';
  if (!/^mongodb(?:\+srv)?:\/\/[^\s/?#]+(?:[/?][^\s]*)?$/.test(mongoUri)) invalid.add('MONGO_URI');
  const corsOrigins: string[] = [];
  for (const origin of (env.CORS_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) throw new Error();
      corsOrigins.push(origin);
    } catch { invalid.add('CORS_ORIGINS'); }
  }
  const rawTrustProxy = env.TRUST_PROXY ?? 'false';
  if (!['true', 'false'].includes(rawTrustProxy)) invalid.add('TRUST_PROXY');
  const rawCookieSameSite = env.COOKIE_SAME_SITE ?? 'lax';
  if (!['lax', 'none'].includes(rawCookieSameSite)) invalid.add('COOKIE_SAME_SITE');
  if (nodeEnv !== 'production' && rawCookieSameSite === 'none') invalid.add('COOKIE_SAME_SITE');
  const mlPythonExecutable = env.ML_PYTHON_EXECUTABLE?.trim() ?? '';
  const mlWorkerScript = env.ML_WORKER_SCRIPT?.trim() ?? '';
  if (mlPythonExecutable && !/^\S+$/.test(mlPythonExecutable)) invalid.add('ML_PYTHON_EXECUTABLE');
  if (mlWorkerScript && !/^\S+$/.test(mlWorkerScript)) invalid.add('ML_WORKER_SCRIPT');
  const rawMlStartupTimeoutMs = env.ML_STARTUP_TIMEOUT_MS ?? '10000';
  const mlStartupTimeoutMs = Number(rawMlStartupTimeoutMs);
  if (!/^\d+$/.test(rawMlStartupTimeoutMs) || !Number.isSafeInteger(mlStartupTimeoutMs) || mlStartupTimeoutMs < 1) invalid.add('ML_STARTUP_TIMEOUT_MS');
  const rawMlInferenceTimeoutMs = env.ML_INFERENCE_TIMEOUT_MS ?? '5000';
  const mlInferenceTimeoutMs = Number(rawMlInferenceTimeoutMs);
  if (!/^\d+$/.test(rawMlInferenceTimeoutMs) || !Number.isSafeInteger(mlInferenceTimeoutMs) || mlInferenceTimeoutMs < 1) invalid.add('ML_INFERENCE_TIMEOUT_MS');
  if (invalid.size) throw new Error(`Invalid configuration: ${[...invalid].join(', ')}`);
  return {
    nodeEnv: nodeEnv as Config['nodeEnv'], host, port, mongoUri,
    corsOrigins: [...new Set(corsOrigins)], trustProxy: rawTrustProxy === 'true',
    cookieSameSite: rawCookieSameSite as Config['cookieSameSite'],
    mlPythonExecutable, mlWorkerScript, mlStartupTimeoutMs, mlInferenceTimeoutMs,
  };
}
