import type { loginAttemptModel } from '../models/login-attempt';

export async function provisionSecurityIndexes(attempts: ReturnType<typeof loginAttemptModel>) {
  // Additive provisioning avoids dropping or rebuilding indexes owned by current domain schemas.
  await attempts.createIndexes();
  const indexes = await attempts.collection.listIndexes().toArray();
  const expiry = indexes.find(index => index.name === 'login_attempt_expiry');
  if (!expiry || expiry.expireAfterSeconds !== 0 || JSON.stringify(expiry.key) !== JSON.stringify({ expiresAt: 1 }))
    throw new Error('Required login-attempt expiry index is missing or incompatible');
  return { loginAttemptExpiryIndex: expiry.name, expireAfterSeconds: 0 };
}
