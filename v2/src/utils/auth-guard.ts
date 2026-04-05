const hasCookie = (name: string) => {
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${name}=`));
};

export function runAuthGuard() {
  // Skip guard in test environments where document isn't available (SSR/build)
  if (typeof document === 'undefined') return;

  const env = (import.meta as any).env || {};
  const loginBase = env.VITE_LOGIN_URL || 'https://bdsmlr.com/login';

  if (hasCookie('bdsmlr7_session')) return;

  window.location.replace(loginBase);
}
