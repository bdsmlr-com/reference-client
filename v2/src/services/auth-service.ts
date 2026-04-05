const DEFAULT_BASE = '/api/v2/auth';
const DEFAULT_TIMEOUT_MS = 4000;

const resolveBase = () => {
  const env = (import.meta as any).env || {};
  const apiBase = env.VITE_AUTH_BASE || DEFAULT_BASE;
  return apiBase.replace(/\/$/, '');
};

const fetchJson = async <T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let resp: Response;
  const env = (import.meta as any).env || {};
  try {
    resp = await fetch(`${resolveBase()}${path}`, {
      credentials: 'include',
      cache: 'no-store',
      mode: env.VITE_AUTH_BASE ? 'cors' : 'same-origin',
      redirect: 'follow',
      signal: controller.signal,
      ...init
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok || resp.status !== 200) {
    throw new Error(`auth request failed: ${resp.status}`);
  }
  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('auth status returned non-JSON');
  }
  const data = (await resp.json()) as any;
  if (data && typeof data.user_id === 'number' && typeof data.blog_id === 'number') {
    return data as T;
  }
  throw new Error('auth status payload invalid');
};

export type AuthStatus = { user_id: number; blog_id: number; blog_name?: string; username?: string };
export type AuthLoginResponse = { user_id: number; blog_id: number; blog_name?: string; username?: string };

export const getStatus = () => {
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return fetchJson<AuthStatus>('/status', { method: 'GET' }, timeoutMs);
};

export const logout = () => {
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return fetchJson<void>('/logout', { method: 'POST' }, timeoutMs).catch(() => {});
};

export const login = (login: string, password: string, remember = false) => {
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const body = JSON.stringify({ login, password, remember });
  return fetchJson<AuthLoginResponse>(
    '/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
    timeoutMs
  );
};
