import { isIP } from 'node:net';

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  mongoUri: string;
  corsOrigins: string[];
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
  if (invalid.size) throw new Error(`Invalid configuration: ${[...invalid].join(', ')}`);
  return { nodeEnv: nodeEnv as Config['nodeEnv'], host, port, mongoUri, corsOrigins: [...new Set(corsOrigins)] };
}
