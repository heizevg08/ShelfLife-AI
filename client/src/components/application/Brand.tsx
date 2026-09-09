// Serve the supplied mark unchanged; wordmark typography belongs to the shared interface.
export function Brand({ inverse = false, login = false }: { inverse?: boolean; login?: boolean }) {
  return <span className="sl-brand-lockup" data-inverse={inverse} data-login={login} role="img" aria-label="ShelfLife AI">
    <span className="sl-brand-icon-box"><img src="/icons/shelflife-logo.svg" alt="" /></span>
    <span className="sl-brand-name sl-desktop-label">ShelfLife <span className="sl-brand-ai">AI</span></span>
  </span>;
}
