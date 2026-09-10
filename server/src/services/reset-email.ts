export interface ResetEmail { send(email: string, token: string): Promise<void> }

// Missing configuration disables recovery, without affecting normal authentication.
export function createResetEmail(env: NodeJS.ProcessEnv, send: typeof fetch = fetch): ResetEmail | undefined {
  const key = env.RESEND_API_KEY, from = env.RESEND_FROM, target = env.PASSWORD_RESET_URL;
  if (!key || !from || !target) return;
  let url: URL;
  try {
    url = new URL(target);
    if (url.username || url.password || url.hash || url.search ||
      !(url.protocol === 'https:' || (env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) return;
  } catch { return; }
  return { async send(email, token) {
    const link = new URL(url); link.hash = `reset=${token}`;
    const response = await send('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Reset your ShelfLife AI password',
        text: `Use this single-use link within 15 minutes to reset your password:\n${link.href}\nIf you did not request this, ignore this email.` }),
    });
    // Provider response details and reset links must never enter logs or client errors.
    if (!response.ok || typeof (await response.json()).id !== 'string') throw new Error('Email delivery unavailable');
  } };
}
