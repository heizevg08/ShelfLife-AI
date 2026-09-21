import type { ClientSession, Mongoose } from 'mongoose';
import { SYSTEM_CONFIG_ID, SYSTEM_DEFAULTS, type systemConfigModel } from '../models/system-config';
import type { auditRecordModel } from '../models/audit-record';
import { auditSnapshot } from './audit-snapshot';
import { bodyFields, decimal, expectedVersion, storedDecimal, versionConflict } from '../validators/inventory-contract';
import { invalid } from '../validators/administration';

export interface SystemConfig { approachingDays: number; criticalDays: number; lowStockMultiplier: string; version: number }
export function systemConfigInput(body: unknown) {
  const input = bodyFields(body, ['expectedVersion', 'approachingDays', 'criticalDays', 'lowStockMultiplier']);
  const version = expectedVersion(input.expectedVersion);
  const patch: Partial<Omit<SystemConfig, 'version'>> = {};
  for (const key of ['approachingDays', 'criticalDays'] as const) if (input[key] !== undefined) {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 36500) invalid(key);
    patch[key] = value;
  }
  if (input.lowStockMultiplier !== undefined) patch.lowStockMultiplier = decimal(input.lowStockMultiplier, 3, 'lowStockMultiplier');
  if (!Object.keys(patch).length) invalid('body', 'Provide at least one setting');
  return { patch, expectedVersion: version };
}
export function createSystemConfig(driver: Mongoose, configs: ReturnType<typeof systemConfigModel>, audits: ReturnType<typeof auditRecordModel>) {
  const read = async (session?: ClientSession): Promise<SystemConfig> => {
    const row = await configs.findById(SYSTEM_CONFIG_ID).session(session ?? null).lean().exec();
    return row ? { approachingDays: row.approachingDays, criticalDays: row.criticalDays, lowStockMultiplier: storedDecimal(row.lowStockMultiplier, 3), version: row.version } : { ...SYSTEM_DEFAULTS };
  };
  return {
    get: () => read(),
    async patch(actorId: string, body: unknown) {
      const input = systemConfigInput(body);
      try {
        return await driver.connection.transaction(async session => {
          const before = await read(session);
          if (before.version !== input.expectedVersion) throw versionConflict();
          const after = { ...before, ...input.patch, version: before.version + 1 };
          if (after.criticalDays > after.approachingDays) invalid('criticalDays', 'Critical threshold must not exceed approaching threshold');
          if (before.version === 0) await configs.create([{ _id: SYSTEM_CONFIG_ID, ...after }], { session });
          else {
            const result = await configs.updateOne({ _id: SYSTEM_CONFIG_ID, version: before.version }, { $set: after }, { session, runValidators: true });
            if (result.modifiedCount !== 1) throw versionConflict();
          }
          await audits.create([{ userId: actorId, action: before.version === 0 ? 'CREATE' : 'UPDATE', targetType: 'SystemConfig', targetId: SYSTEM_CONFIG_ID, oldValue: before.version === 0 ? null : auditSnapshot('SystemConfig', before), newValue: auditSnapshot('SystemConfig', after) }], { session });
          return after;
        });
      } catch (error) { if ((error as { code?: number }).code === 11000) throw versionConflict(); throw error; }
    },
  };
}
export type SystemConfigService = ReturnType<typeof createSystemConfig>;
