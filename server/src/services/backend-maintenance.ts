import type { Mongoose } from 'mongoose';
import type { ingredientModel } from '../models/ingredient';
import type { loginAttemptModel } from '../models/login-attempt';
import type { userModel } from '../models/user';
import type { auditRecordModel } from '../models/audit-record';
import { auditSnapshot } from './audit-snapshot';

export async function provisionHardeningIndexes(ingredients: ReturnType<typeof ingredientModel>, attempts: ReturnType<typeof loginAttemptModel>) {
  // Explicit, additive provisioning: never drop/rebuild unrelated indexes with syncIndexes().
  await ingredients.createIndexes();
  await attempts.createIndexes();
  const indexes = await ingredients.collection.listIndexes().toArray();
  const uniqueName = indexes.find(index => Object.keys(index.key).length === 1 && index.key.name === 1 && index.unique === true
    && index.collation?.locale === 'en' && index.collation?.strength === 2 && !index.partialFilterExpression && !index.sparse);
  if (!uniqueName) throw new Error('Required ingredient name uniqueness index is missing');
  return { ingredientNameIndex: uniqueName.name, unique: true, collation: { locale: 'en', strength: 2 } };
}

export async function migrateManagerRole(driver: Mongoose, users: ReturnType<typeof userModel>, audits: ReturnType<typeof auditRecordModel>) {
  // A system actor records this maintenance operation without impersonating a teammate.
  return driver.connection.transaction(async session => {
    const rows = await users.find({ role: /^Manager$/ }).select('_id firstName lastName name email role isActive createdAt updatedAt').session(session).lean().exec();
    for (const before of rows) {
      const after = await users.findByIdAndUpdate(before._id, {
        $set: { role: 'Inventory Manager' }, $inc: { authVersion: 1 }, $unset: { resetTokenHash: 1, resetExpiresAt: 1 },
      }, { session, returnDocument: 'after', runValidators: true }).lean().exec();
      if (!after) throw new Error('Account changed during role migration');
      await audits.create([{
        actorType: 'System', userId: null, action: 'UPDATE', targetType: 'User', targetId: before._id,
        oldValue: auditSnapshot('User', { ...before, id: before._id.toString() }),
        newValue: auditSnapshot('User', { ...after, id: after._id.toString() }),
      }], { session });
    }
    return rows.length;
  });
}
