import nodemailer from 'nodemailer';

/** Plain-text account email sent by the configured delivery transport. */
export interface MailMessage { to: string; subject: string; text: string }
/** Delivery boundary that rejects when the provider does not accept a message. */
export interface MailTransport { send(message: MailMessage): Promise<void> }

function safeHeader(value: string | undefined): string | undefined {
  const clean = value?.trim();
  return clean && !/[\r\n]/.test(clean) ? clean : undefined;
}

/**
 * Build SMTP delivery (or HTTPS port-443 relay for Render Free Tier) when every required setting is valid.
 * @param env - SMTP host, port, credentials, and sender settings.
 * @param createTransport - Injectable Nodemailer factory for verification.
 * @returns Mail transport, or `undefined` when SMTP is not configured.
 */
export function createSmtpMailTransport(env: NodeJS.ProcessEnv, createTransport: typeof nodemailer.createTransport = nodemailer.createTransport): MailTransport | undefined {
  const host = safeHeader(env.SMTP_HOST);
  const user = safeHeader(env.SMTP_USER);
  const configuredPass = env.SMTP_PASS;
  // Google displays app passwords in four groups separated by spaces.
  const strippedPass = configuredPass ? configuredPass.replace(/\s+/g, '') : undefined;
  const pass = (host?.toLowerCase() === 'smtp.gmail.com' || host?.toLowerCase().startsWith('https://script.google.com/'))
    ? strippedPass
    : configuredPass;
  const fromAddress = safeHeader(env.MAIL_FROM) ?? user;
  const fromName = safeHeader(env.SMTP_FROM_NAME) ?? 'ShelfLife AI';
  const port = Number(env.SMTP_PORT || (host?.toLowerCase().startsWith('https://') ? 443 : NaN));
  if (!host || !user || !pass || !fromAddress || !Number.isInteger(port) || port < 1 || port > 65535) return;
  if (host.toLowerCase().startsWith('https://')) {
    return {
      async send(message) {
        // Try pass (stripped for Google Apps Script / Gmail) and raw configuredPass if different
        const candidates = [pass];
        if (configuredPass && configuredPass !== pass) candidates.push(configuredPass);

        let lastBody = '';
        let lastStatus = 500;

        for (const candidate of candidates) {
          const response = await fetch(host, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            redirect: 'follow',
            body: JSON.stringify({
              secret: candidate,
              user,
              fromName,
              fromAddress,
              to: message.to,
              subject: message.subject,
              text: message.text,
            }),
            signal: AbortSignal.timeout(15000),
          });
          const body = (await response.text().catch(() => '')).trim();
          if (response.ok && !/^unauthorized$/i.test(body) && !/^error:/i.test(body)) {
            return;
          }
          lastBody = body;
          lastStatus = response.status;
        }

        const err = new Error(lastBody || `HTTPS mail relay failed with status ${lastStatus}`) as Error & { code?: string };
        if (lastStatus === 401 || lastStatus === 403 || /^unauthorized$/i.test(lastBody)) err.code = 'EAUTH';
        throw err;
      },
    };
  }
  const smtp = createTransport({
    host, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  return { async send(message) {
    await smtp.sendMail({ from: { name: fromName, address: fromAddress }, ...message });
  } };
}
