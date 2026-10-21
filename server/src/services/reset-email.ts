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
    const escapedLink = link.href.replace(/"/g, '&quot;');
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your ShelfLife AI password</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f4f6f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="padding: 32px 32px 16px 32px; text-align: left;">
        <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #11613C;">ShelfLife AI</h2>
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">Password Recovery Request</h3>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #4b5563;">
          We received a request to reset the password for your ShelfLife AI account. Click the secure button below to choose a new password:
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${escapedLink}" target="_blank" style="display: inline-block; background-color: #11613C; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; box-shadow: 0 2px 4px rgba(17, 97, 60, 0.2);">Reset Password</a>
        </div>
        <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #6b7280;">
          ⚠️ <strong>Security Notice:</strong> This single-use link is valid for <strong>15 minutes</strong> and will expire immediately after use.
        </p>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #9ca3af;">
          If you did not request a password reset, you can safely ignore this email. Your current password remains secure.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px 24px 32px; background-color: #f9fafb; border-top: 1px solid #f3f4f6; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">ShelfLife AI &bull; Intelligent Food Inventory & Waste Management</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
    await transport.send({
      to: email,
      subject: 'Reset your ShelfLife AI password',
      text: `Use this single-use link within 15 minutes to reset your password:\n${link.href}\nIf you did not request this, ignore this email.`,
      html,
    });
  } };
}
