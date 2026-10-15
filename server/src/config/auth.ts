import { normalizeEmail, validPassword } from '../validators/auth';

export function readJwtSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32 || secret.trim() !== secret) throw new Error('Invalid configuration: JWT_SECRET');
  return secret;
}
export function readDevAdmin(env: NodeJS.ProcessEnv) {
  if ((env.NODE_ENV ?? 'development') !== 'development') throw new Error('Development seed requires NODE_ENV=development');
  const email = normalizeEmail(env.DEV_ADMIN_EMAIL);
  const firstName = env.DEV_ADMIN_FIRST_NAME?.trim();
  const lastName = env.DEV_ADMIN_LAST_NAME?.trim();
  const password = env.DEV_ADMIN_PASSWORD;
  if (!email) throw new Error('Invalid configuration: DEV_ADMIN_EMAIL');
  if (!firstName || firstName.length > 100) throw new Error('Invalid configuration: DEV_ADMIN_FIRST_NAME');
  if (!lastName || lastName.length > 100) throw new Error('Invalid configuration: DEV_ADMIN_LAST_NAME');
  if (!validPassword(password) || password.length < 12) throw new Error('Invalid configuration: DEV_ADMIN_PASSWORD');
  return { email, firstName, lastName, password };
}
