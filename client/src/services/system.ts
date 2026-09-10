// The API reports liveness and combined readiness, not standalone database health.
export interface SystemAvailability { backendAlive: boolean; backendReady: boolean; checkedAt: Date }

export async function getSystemAvailability(signal: AbortSignal): Promise<SystemAvailability> {
  const base = (process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
  const [live, ready] = await Promise.all(['live', 'ready'].map(async path => {
    const response = await fetch(`${base}/api/health/${path}`, { cache: 'no-store', signal });
    // A valid 503 reports an unhealthy service; other failures leave status unknown.
    if (!response.ok && response.status !== 503) throw new Error('Status unavailable');
    const body = await response.json();
    const expected = path === 'live' ? ['alive'] : ['ready', 'not_ready'];
    if (!expected.includes(body.status)) throw new Error('Status unavailable');
    return response.ok && (body.status === 'alive' || body.status === 'ready');
  }));
  return { backendAlive: live, backendReady: ready, checkedAt: new Date() };
}
