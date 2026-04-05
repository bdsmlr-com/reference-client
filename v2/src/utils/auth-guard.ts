const hasCookie = (name: string) => document.cookie.split(';').some(c => c.trim().startsWith(`${name}=`));

const buildLoginUrl = (base: string, current: string) => {
  try {
    const url = new URL(base);
    url.searchParams.set('next', current);
    return url.toString();
  } catch {
    // fall back if base isn't a valid URL
    return `${base}?next=${encodeURIComponent(current)}`;
  }
};

export function runAuthGuard() {
  const env = (import.meta as any).env || {};
  const buildEnv = env.VITE_BUILD_ENV || env.APP_ENV || env.MODE || env.NODE_ENV;
  const loginBase = env.VITE_LOGIN_URL || 'https://bdsmlr.com/login';
  const isProd = String(buildEnv || '').toLowerCase() === 'prod';

  if (!isProd) return;
  if (hasCookie('bdsmlr7_session')) return;

  const target = buildLoginUrl(loginBase, window.location.href);
  window.location.replace(target);
}
