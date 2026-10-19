import { createServer } from 'node:http';
import type { EventEmitter } from 'node:events';
import { createApp } from './app';
import { createDatabase, type Database } from './config/database';
import { readConfig, type Config } from './config/env';
import { Mongoose } from 'mongoose';
import { readJwtSecret } from './config/auth';
import { normalizeUserRole, userModel } from './models/user';
import { createAuth, type AuthService } from './services/auth';
import { persistentSessionModel } from './models/persistent-session';
import { createPersistentSessions } from './services/persistent-session';
import { createPasswordRecovery } from './services/password-recovery';
import { createPasswordChange } from './services/password-change';
import { createProfileUpdate } from './services/profile-update';
import { createResetEmail } from './services/reset-email';
import { createEmailChangeEmail } from './services/email-change-email';
import { createEmailChange } from './services/email-change';
import { createEmailChangeStore } from './services/email-change-store';
import type { AuthExtensions } from './routes/auth.routes';
import { auditRecordModel } from './models/audit-record';
import { withAuditRecordedNotifications } from './services/audit-events';
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
import { createReportExports, type ReportExportService } from './services/report-export';
import { createForecastInferenceWorker } from './services/forecast-inference-worker';
import { createForecastingHistoryStore } from './services/forecasting-history-store';
import { createOperationalForecastService } from './services/operational-forecast';
import { createOperationalRiskService } from './services/operational-risk';
import { createOperationalRecommendationService } from './services/operational-recommendations';
import type { OperationalForecastService } from './services/operational-forecast';
import type { OperationalRiskService } from './services/operational-risk';
import type { OperationalRecommendationService } from './services/operational-recommendations';

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

export async function startServer(config: Config, database: Database, shutdownTimeout = 5000, auth?: AuthService, onStage: (stage: StartupStage) => void = () => {}, extensions?: AuthExtensions, administration?: AdministrationService, ingredients?: IngredientService, inventoryBatches?: InventoryBatchService, usageRecords?: UsageRecordService, wasteRecords?: WasteRecordService, changeRequests?: any, reports?: ReportExportService, operationalForecast?: OperationalForecastService, operationalRisk?: OperationalRiskService, operationalRecommendations?: OperationalRecommendationService) {
  let stage: StartupStage = 'application-composition';
  onStage(stage);
  let stopping = false;
  const http = createServer(createApp(config.corsOrigins, () => !stopping && database.isConnected(), auth, extensions, administration, ingredients, inventoryBatches, usageRecords, wasteRecords, changeRequests, reports, operationalForecast, operationalRisk, operationalRecommendations));
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
    const passwordChange = createPasswordChange({
      byIdWithHash: (id: string) => users.findById(id).select('+passwordHash').lean().exec(),
      applyPasswordChange: async (id: string, passwordHash: string) => {
        // One atomic write: the new hash lands only for an active account, the outstanding
        // reset request is cleared, and the version bump invalidates every access token and
        // refresh session already issued to this account.
        const result = await users.updateOne({ _id: id, isActive: true }, {
          $set: { passwordHash }, $unset: { resetTokenHash: 1, resetExpiresAt: 1 }, $inc: { authVersion: 1 },
        }).exec();
        return result.modifiedCount === 1;
      },
    });
    const audits = withAuditRecordedNotifications(auditRecordModel(driver));
    // Authentication events share the wrapped audit model, so their persistence and
    // the SSE wake-up notification cannot drift apart. Only identity crosses this
    // boundary; credentials, tokens and session material never reach the audit trail.
    const auditAuthenticationEvent = async (action: 'LOGIN' | 'LOGOUT', actor: { id: string; name: string; role: string }) => {
      await audits.create({ userId: actor.id, actorName: actor.name?.trim() || 'Unknown account', actorRole: normalizeUserRole(actor.role) ?? undefined,
        action, targetType: 'User', targetId: actor.id, targetName: 'Own account', module: 'Authentication', status: 'Success' });
    };
    const emailChange = createEmailChange(createEmailChangeStore(driver, users, audits), createEmailChangeEmail(process.env));
    const profileUpdate = createProfileUpdate({
      byId: (id: string) => users.findById(id).lean().exec(),
      // Optimistic write: the name parts only change while they still hold the values the
      // caller was shown, so two concurrent edits cannot silently overwrite each other.
      applyName: async (id: string, expected: { firstName: string; lastName: string }, next: { firstName: string; lastName: string; name: string }) => {
        const result = await users.updateOne({ _id: id, isActive: true, firstName: expected.firstName, lastName: expected.lastName },
          { $set: { firstName: next.firstName, lastName: next.lastName, name: next.name } }).exec();
        return result.modifiedCount === 1;
      },
    }, async (actor, details) => {
      // The record names the account and the changed fields only. No credential, token or
      // internal identifier beyond the account's own id is written.
      await audits.create({ userId: actor.id, actorName: actor.name, actorRole: normalizeUserRole(actor.role) ?? undefined,
        action: 'UPDATE', targetType: 'User', targetId: actor.id, targetName: 'Own account', module: 'Account Profile', status: 'Success', details });
    });
    const administration = createAdministration(createAdministrationStore(driver, users, audits));
    const ingredients = createIngredients(createIngredientStore(driver, ingredientModel(driver), users, audits));
    const inventoryBatches = createInventoryBatches(createInventoryBatchStore(driver, inventoryBatchModel(driver), inventoryBatchCounterModel(driver), ingredientModel(driver), users, audits));
    const usageRecords = createUsageRecords(createUsageRecordStore(driver, usageRecordModel(driver), inventoryBatchModel(driver), ingredientModel(driver), users, audits));
    const wasteRecords = createWasteRecords(createWasteRecordStore(driver, wasteRecordModel(driver), inventoryBatchModel(driver), ingredientModel(driver), users, audits));
    const changeRequests = createChangeRequests(driver, changeRequestModel(driver), changeRequestCounterModel(driver), ingredientModel(driver), inventoryBatchModel(driver), users, audits);
    const reports = createReportExports({ batches: inventoryBatchModel(driver), ingredients: ingredientModel(driver), usage: usageRecordModel(driver), waste: wasteRecordModel(driver), audits });
    let operationalForecast: OperationalForecastService | undefined;
    let operationalRisk: OperationalRiskService | undefined;
    let operationalRecommendations: OperationalRecommendationService | undefined;
    if (config.mlPythonExecutable && config.mlWorkerScript) {
      const forecastWorker = createForecastInferenceWorker(config);
      const forecastHistoryStore = createForecastingHistoryStore(usageRecordModel(driver), ingredientModel(driver));
      operationalForecast = createOperationalForecastService(forecastHistoryStore, forecastWorker);
      operationalRisk = createOperationalRiskService(operationalForecast, ingredientModel(driver), inventoryBatchModel(driver));
      operationalRecommendations = createOperationalRecommendationService(operationalRisk);
    }
    const database = createDatabase(driver);
    const indexedDatabase = { ...database, connect: async (uri: string) => {
      await database.connect(uri);
      await provisionSecurityIndexes(loginAttempts);
    } };
    const runtime = await startServer(config, indexedDatabase, 5000, auth, onStage, { loginLimiter, sessions: persistent, recovery, passwordChange, profileUpdate, emailChange, secureCookies: config.nodeEnv === 'production', auditAuthenticationEvent }, administration, ingredients, inventoryBatches, usageRecords, wasteRecords, changeRequests, reports, operationalForecast, operationalRisk, operationalRecommendations);
    onStage('shutdown-registration');
    registerShutdown(process, runtime.stop, code => process.exit(code));
    console.info('Backend listening');
  })().catch(error => {
    console.error('Backend startup failed', error instanceof StartupFailure ? error.diagnostic : startupDiagnostic(stage, error));
    process.exit(1);
  });
}
