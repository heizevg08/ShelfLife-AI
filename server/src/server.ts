import { createServer } from 'node:http';
import type { EventEmitter } from 'node:events';
import { createApp } from './app';
import { createDatabase, type Database } from './config/database';
import { readConfig, type Config } from './config/env';
import { Mongoose } from 'mongoose';
import { readJwtSecret } from './config/auth';
import { userModel } from './models/user';
import { createAuth, type AuthService } from './services/auth';

async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Operation timed out')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export async function startServer(config: Config, database: Database, shutdownTimeout = 5000, auth?: AuthService) {
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
    await database.connect(config.mongoUri);
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(config.port, config.host, () => { http.off('error', reject); resolve(); });
    });
  } catch {
    await stop();
    throw new Error('Backend startup failed');
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
  void (async () => {
    const config = readConfig(process.env);
    const secret = readJwtSecret(process.env);
    const driver = new Mongoose();
    const users = userModel(driver);
    const auth = createAuth({
      byEmail: email => users.findOne({ email }).select('+passwordHash').lean().exec(),
      byId: id => users.findById(id).lean().exec(),
    }, secret);
    const runtime = await startServer(config, createDatabase(driver), 5000, auth);
    console.info('Backend listening');
    registerShutdown(process, runtime.stop, code => process.exit(code));
  })().catch(error => {
    // Configuration failures contain field names only. Never log driver errors.
    console.error(error instanceof Error && error.message.startsWith('Invalid configuration:')
      ? error.message : 'Backend startup failed');
    process.exit(1);
  });
}
