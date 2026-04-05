const DEFAULT_BASE = 'https://bdsmlr.com/auth';
const DEFAULT_TIMEOUT_MS = 4000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return promise.finally(() => clearTimeout(timer)) as Promise<T>;
};

const resolveBase = () => {
  const env = (import.meta as any).env || {};
  const apiBase = env.VITE_AUTH_BASE || DEFAULT_BASE;
  return apiBase.replace(/\/$/, '');
};

const fetchJson = async <T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> => {
  const resp = await withTimeout(
    fetch(`${resolveBase()}${path}`, {
      credentials: 'include',
      cache: 'no-store',
      mode: 'cors',
      ...init
    }),
    timeoutMs
  );

  if (!resp.ok) {
    throw new Error(`auth request failed: ${resp.status}`);
  }
  if (resp.status === 204) return undefined as unknown as T;
  return (await resp.json()) as T;
};

export type AuthStatus = { user_id: number; blog_id: number };

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
