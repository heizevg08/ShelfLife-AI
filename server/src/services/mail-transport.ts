import nodemailer from 'nodemailer';

export interface MailMessage { to: string; subject: string; text: string }
export interface MailTransport { send(message: MailMessage): Promise<void> }

function safeHeader(value: string | undefined): string | undefined {
  const clean = value?.trim();
  return clean && !/[\r\n]/.test(clean) ? clean : undefined;
}

export function createSmtpMailTransport(env: NodeJS.ProcessEnv, createTransport: typeof nodemailer.createTransport = nodemailer.createTransport): MailTransport | undefined {
  const host = safeHeader(env.SMTP_HOST);
  const user = safeHeader(env.SMTP_USER);
  const configuredPass = env.SMTP_PASS;
  // Google displays app passwords in four groups separated by spaces. Those spaces
  // are for readability and must not be included in SMTP authentication.
  const pass = host?.toLowerCase() === 'smtp.gmail.com' ? configuredPass?.replace(/\s+/g, '') : configuredPass;
  const fromAddress = safeHeader(env.MAIL_FROM) ?? user;
  const fromName = safeHeader(env.SMTP_FROM_NAME) ?? 'ShelfLife AI';
  const port = Number(env.SMTP_PORT);
  if (!host || !user || !pass || !fromAddress || !Number.isInteger(port) || port < 1 || port > 65535) return;
  const smtp = createTransport({
    host, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  return { async send(message) {
    await smtp.sendMail({ from: { name: fromName, address: fromAddress }, ...message });
  } };
}
