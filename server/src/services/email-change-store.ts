import type { Mongoose } from 'mongoose';
import type { userModel } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import { normalizeUserRole } from '../models/user';
import { EMAIL_CHANGE_ROLES, type EmailChangeStore } from './email-change';

export function createEmailChangeStore(driver: Mongoose, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>): EmailChangeStore {
  return {
    byIdWithSecrets: id => users.findById(id).select('+passwordHash +emailChangeSentAt').lean().exec(),
    emailExists: async (email, excludingId) => !!await users.exists({ email, _id: { $ne: excludingId } }),
    // The role predicate is part of the guarded write, so an unauthorized role cannot stage, count
    // a failure against, or activate a change even if the service-level check were bypassed.
    stage: async (id, email, hash, expiresAt, sentAt) => (await users.updateOne({ _id: id, isActive: true, role: { $in: EMAIL_CHANGE_ROLES } }, { $set: {
      pendingEmail: email, emailChangeCodeHash: hash, emailChangeExpiresAt: expiresAt, emailChangeSentAt: sentAt, emailChangeAttempts: 0,
    } }).exec()).modifiedCount === 1,
    fail: async (id, hash, now) => {
      const row = await users.findOneAndUpdate({ _id: id, role: { $in: EMAIL_CHANGE_ROLES }, emailChangeCodeHash: { $ne: hash }, emailChangeExpiresAt: { $gt: now }, emailChangeAttempts: { $lt: 5 } },
        { $inc: { emailChangeAttempts: 1 } }, { returnDocument: 'after' }).select('+emailChangeAttempts').lean().exec();
      return row?.emailChangeAttempts ?? 5;
    },
    activate: async (id, hash, now) => {
      try {
        return await driver.connection.transaction(async session => {
          const row = await users.findOne({ _id: id, isActive: true, role: { $in: EMAIL_CHANGE_ROLES }, emailChangeCodeHash: hash, emailChangeExpiresAt: { $gt: now }, emailChangeAttempts: { $lt: 5 } })
            .select('+pendingEmail').session(session).lean().exec();
          if (!row?.pendingEmail || await users.exists({ email: row.pendingEmail, _id: { $ne: id } }).session(session)) return false;
          // Repeat every security predicate in the write itself. The role, address, OTP, expiry,
          // attempt count and active state cannot change between verification and activation.
          const result = await users.updateOne({ _id: id, isActive: true, role: { $in: EMAIL_CHANGE_ROLES }, email: row.email, pendingEmail: row.pendingEmail,
            emailChangeCodeHash: hash, emailChangeExpiresAt: { $gt: now }, emailChangeAttempts: { $lt: 5 } }, {
            $set: { email: row.pendingEmail }, $unset: { pendingEmail: 1, emailChangeCodeHash: 1, emailChangeExpiresAt: 1, emailChangeSentAt: 1, emailChangeAttempts: 1 }, $inc: { authVersion: 1 },
          }, { session }).exec();
          if (result.modifiedCount !== 1) return false;
          await audits.create([{ userId: id, actorName: `${row.firstName} ${row.lastName}`.trim(), actorRole: normalizeUserRole(row.role) ?? undefined,
            action: 'UPDATE', targetType: 'User', targetId: id, targetName: 'Own account', module: 'Account Profile', status: 'Success',
            details: 'Self-service email address changed after ownership verification' }], { session });
          return true;
        });
      } catch (error) {
        // A concurrent account creation can win the unique email index after the precheck.
        if ((error as { code?: unknown }).code === 11000) return false;
        throw error;
      }
    },
    clear: id => users.updateOne({ _id: id }, { $unset: { pendingEmail: 1, emailChangeCodeHash: 1, emailChangeExpiresAt: 1, emailChangeSentAt: 1, emailChangeAttempts: 1 } }).exec(),
  };
}
