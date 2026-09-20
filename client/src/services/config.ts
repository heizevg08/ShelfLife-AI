// Public browser configuration only. Never put database or signing secrets here.
export const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
