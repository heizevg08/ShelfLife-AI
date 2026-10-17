import { createSmtpMailTransport, type MailTransport } from './mail-transport';

export interface AccountWelcomeEmail { available: true; send(email: string, name: string, temporaryPassword: string): Promise<void> }

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
  return { available: true, async send(email, name, temporaryPassword) {
    await transport.send({ to: email, subject: 'Your ShelfLife AI account is ready',
      text: `Hello ${name},\n\nYour ShelfLife AI account has been created. Sign in at:\n${url.href}\n\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nYou must choose a new password immediately after signing in. The temporary password will stop working once it is changed. If you did not expect this account, contact your administrator.` });
  } };
}
