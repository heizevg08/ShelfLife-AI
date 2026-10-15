import { createSmtpMailTransport, type MailTransport } from './mail-transport';

export interface ResetEmail { send(email: string, token: string): Promise<void> }

// Missing configuration disables recovery, without affecting normal authentication.
export function createResetEmail(env: NodeJS.ProcessEnv, transport: MailTransport | undefined = createSmtpMailTransport(env)): ResetEmail | undefined {
  const target = env.PASSWORD_RESET_URL;
  if (!transport || !target) return;
  let url: URL;
  try {
    url = new URL(target);
    if (url.username || url.password || url.hash || url.search ||
      !(url.protocol === 'https:' || (env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) return;
  } catch { return; }
  return { async send(email, token) {
    const link = new URL(url); link.hash = `reset=${token}`;
    await transport.send({ to: email, subject: 'Reset your ShelfLife AI password',
      text: `Use this single-use link within 15 minutes to reset your password:\n${link.href}\nIf you did not request this, ignore this email.` });
  } };
}
