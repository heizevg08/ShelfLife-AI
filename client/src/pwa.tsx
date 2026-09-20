import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdate() {
  const { needRefresh: [needsUpdate, setNeedsUpdate], updateServiceWorker } = useRegisterSW();
  if (!needsUpdate) return null;
  return <aside className="sl-pwa-update" role="status" aria-label="Application update">
    <p>A new version is ready. Save your work before reloading.</p>
    <button className="sl-button sl-button-primary" onClick={() => void updateServiceWorker(true)}>Reload app</button>
    <button className="sl-button" onClick={() => setNeedsUpdate(false)}>Later</button>
  </aside>;
}
