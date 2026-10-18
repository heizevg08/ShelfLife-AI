import type { loginAttemptModel } from '../models/login-attempt';
import type { userModel } from '../models/user';

export async function provisionSecurityIndexes(attempts: ReturnType<typeof loginAttemptModel>, users?: ReturnType<typeof userModel>) {
  // Additive provisioning avoids dropping or rebuilding indexes owned by current domain schemas.
  // Mongoose autoIndex is disabled in production, so the account email uniqueness constraint
  // must be explicitly created before the server accepts account writes.
  await users?.createIndexes();
  await attempts.createIndexes();
  const indexes = await attempts.collection.listIndexes().toArray();
  const expiry = indexes.find(index => index.name === 'login_attempt_expiry');
  if (!expiry || expiry.expireAfterSeconds !== 0 || JSON.stringify(expiry.key) !== JSON.stringify({ expiresAt: 1 }))
    throw new Error('Required login-attempt expiry index is missing or incompatible');
  return { loginAttemptExpiryIndex: expiry.name, expireAfterSeconds: 0 };
}
