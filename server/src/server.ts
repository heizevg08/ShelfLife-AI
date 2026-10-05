import { createServer } from 'node:http';
import type { EventEmitter } from 'node:events';
import { createApp } from './app';
import { createDatabase, type Database } from './config/database';
import { readConfig, type Config } from './config/env';
import { Mongoose } from 'mongoose';
import { readJwtSecret } from './config/auth';
import { userModel } from './models/user';
import { createAuth, type AuthService } from './services/auth';
import { persistentSessionModel } from './models/persistent-session';
import { createPersistentSessions } from './services/persistent-session';
import { createPasswordRecovery } from './services/password-recovery';
import { createResetEmail } from './services/reset-email';
import type { AuthExtensions } from './routes/auth.routes';
import { auditRecordModel } from './models/audit-record';
import { createAdministration, type AdministrationService } from './services/administration';
import { createAdministrationStore } from './services/administration-store';
import { ingredientModel } from './models/ingredient';
import { createIngredients, type IngredientService } from './services/ingredients';
import { createIngredientStore } from './services/ingredient-store';
import { inventoryBatchModel } from './models/inventory-batch';
import { createInventoryBatches, type InventoryBatchService } from './services/inventory-batches';
import { createInventoryBatchStore } from './services/inventory-batch-store';
import { inventoryBatchCounterModel } from './models/inventory-batch-counter';
import { usageRecordModel } from './models/usage-record';
import { createUsageRecords, type UsageRecordService } from './services/usage-records';
import { createUsageRecordStore } from './services/usage-record-store';
import { wasteRecordModel } from './models/waste-record';
import { createWasteRecords, type WasteRecordService } from './services/waste-records';
import { createWasteRecordStore } from './services/waste-record-store';
import { changeRequestModel } from './models/change-request';
import { changeRequestCounterModel } from './models/change-request-counter';
import { createChangeRequests } from './services/change-requests';
import { loginAttemptModel } from './models/login-attempt';
import { createLoginLimiter, mongoLoginAttemptStore } from './services/login-limiter';
import { provisionSecurityIndexes } from './services/security-indexes';

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

export async function startServer(config: Config, database: Database, shutdownTimeout = 5000, auth?: AuthService, onStage: (stage: StartupStage) => void = () => {}, extensions?: AuthExtensions, administration?: AdministrationService, ingredients?: IngredientService, inventoryBatches?: InventoryBatchService, usageRecords?: UsageRecordService, wasteRecords?: WasteRecordService, changeRequests?: any) {
  let stage: StartupStage = 'application-composition';
  onStage(stage);
  let stopping = false;
  const http = createServer(createApp(config.corsOrigins, () => !stopping && database.isConnected(), auth, extensions, administration, ingredients, inventoryBatches, usageRecords, wasteRecords, changeRequests));
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
    await inventoryBatches?.ready();
    await usageRecords?.ready();
    await wasteRecords?.ready();
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
    const userStore = {
      byEmail: (email: string) => users.findOne({ email }).select('+passwordHash').lean().exec(),
      byId: (id: string) => users.findById(id).lean().exec(),
      recordLogin: async (id: string, at: Date) => { await users.updateOne({ _id: id, isActive: true }, { $set: { lastLoginAt: at } }).exec(); },
    };
    const auth = createAuth(userStore, secret);
    const loginAttempts = loginAttemptModel(driver);
    const loginLimiter = createLoginLimiter(mongoLoginAttemptStore(loginAttempts));
    const sessions = persistentSessionModel(driver);
    const persistent = createPersistentSessions({
      create: record => sessions.create(record),
      rotate: (hash, next, now) => sessions.findOneAndUpdate({ tokenHash: hash, expiresAt: { $gt: now } }, { $set: { tokenHash: next } }).lean().exec(),
      revoke: hash => sessions.deleteMany({ tokenHash: hash }).exec(),
    }, userStore, auth);
    const recovery = createPasswordRecovery({
      ...userStore,
      setReset: (id, hash, expires) => users.updateOne({ _id: id, isActive: true }, { $set: { resetTokenHash: hash, resetExpiresAt: expires } }).exec(),
      clearReset: hash => users.updateOne({ resetTokenHash: hash }, { $unset: { resetTokenHash: 1, resetExpiresAt: 1 } }).exec(),
      consumeReset: async (hash, now, passwordHash) => {
        // One atomic update consumes the token and revokes existing access/refresh credentials by version.
        const result = await users.updateOne({ resetTokenHash: hash, resetExpiresAt: { $gt: now }, isActive: true }, {
          $set: { passwordHash }, $unset: { resetTokenHash: 1, resetExpiresAt: 1 }, $inc: { authVersion: 1 },
        }).exec();
        return result.modifiedCount === 1;
      },
    }, createResetEmail(process.env));
    const audits = auditRecordModel(driver);
    const administration = createAdministration(createAdministrationStore(driver, users, audits));
    const ingredients = createIngredients(createIngredientStore(driver, ingredientModel(driver), users, audits));
    const inventoryBatches = createInventoryBatches(createInventoryBatchStore(driver, inventoryBatchModel(driver), inventoryBatchCounterModel(driver), ingredientModel(driver), users, audits));
    const usageRecords = createUsageRecords(createUsageRecordStore(driver, usageRecordModel(driver), inventoryBatchModel(driver), ingredientModel(driver), users, audits));
    const wasteRecords = createWasteRecords(createWasteRecordStore(driver, wasteRecordModel(driver), inventoryBatchModel(driver), ingredientModel(driver), users, audits));
    const changeRequests = createChangeRequests(driver, changeRequestModel(driver), changeRequestCounterModel(driver), ingredientModel(driver), inventoryBatchModel(driver), users, audits);
    const database = createDatabase(driver);
    const indexedDatabase = { ...database, connect: async (uri: string) => {
      await database.connect(uri);
      await provisionSecurityIndexes(loginAttempts);
    } };
    const runtime = await startServer(config, indexedDatabase, 5000, auth, onStage, { loginLimiter, sessions: persistent, recovery, secureCookies: config.nodeEnv === 'production' }, administration, ingredients, inventoryBatches, usageRecords, wasteRecords, changeRequests);
    onStage('shutdown-registration');
    registerShutdown(process, runtime.stop, code => process.exit(code));
    console.info('Backend listening');
  })().catch(error => {
    console.error('Backend startup failed', error instanceof StartupFailure ? error.diagnostic : startupDiagnostic(stage, error));
    process.exit(1);
  });
}
