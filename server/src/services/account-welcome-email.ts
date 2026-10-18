import { createSmtpMailTransport, type MailTransport } from './mail-transport';

export interface AccountWelcomeEmail { available: true; send(email: string, name: string, temporaryPassword: string, accountEmail?: string): Promise<void> }

export function createAccountWelcomeEmail(env: NodeJS.ProcessEnv, transport: MailTransport | undefined = createSmtpMailTransport(env)): AccountWelcomeEmail | undefined {
  const origin = env.CORS_ORIGINS?.split(',').map(value => value.trim()).find(Boolean);
  let target = env.ACCOUNT_LOGIN_URL?.trim();
  if (!target && origin) {
    try { target = new URL('/ShelfLifeAILogin', origin).href; }
    catch { return; }
  }
  if (!transport || !target) return;
  let url: URL;
  try {
    url = new URL(target);
    if (url.username || url.password || url.hash || url.search ||
      !(url.protocol === 'https:' || (env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) return;
  } catch { return; }
  let termsUrl: URL;
  try {
    termsUrl = new URL(env.ACCOUNT_TERMS_URL?.trim() || '/terms', url.origin);
    if (termsUrl.username || termsUrl.password || termsUrl.hash || termsUrl.search ||
      !(termsUrl.protocol === 'https:' || (env.NODE_ENV !== 'production' && termsUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(termsUrl.hostname)))) return;
  } catch { return; }
  return { available: true, async send(email, name, temporaryPassword, accountEmail = email) {
    await transport.send({ to: email, subject: 'Welcome to ShelfLife AI – Your Account Details',
      text: `Hello ${name},\n\nYour ShelfLife AI account has been successfully created.\n\nSign-In URL: ${url.href}\nAccount Email: ${accountEmail}\nTemporary Password: [ ${temporaryPassword} ]\n\n⚠️ Security Notice: You will be required to choose a new password immediately upon your first sign-in. This temporary password will expire after first use.\n\nIf you did not request this account, please contact your system administrator.\n\n---\nBy signing in, you agree to the ShelfLife AI Terms of Service and Privacy Policy.\n${termsUrl.href}` });
  } };
}
