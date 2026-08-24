import { getAuthUser } from '../state/auth-state.js';
import {
  clearAuthStatusCache,
  peekAuthStatusCache,
  writeAuthStatusCache,
} from './auth-status-cache.js';
import { trackOutageEvent } from './google-analytics.js';
import { isApexRuntime, resolveTransportBase, type TransportScope } from './transport-base.js';

const DEFAULT_TIMEOUT_MS = 16000;

export class AuthRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`auth request failed: ${status}`);
    this.name = 'AuthRequestError';
    this.status = status;
  }
}

/**
 * Login form copy. Do not surface API bodies — Cloudflare/proxies often return
 * HTML challenge pages that are useless as UI text.
 */
export const formatLoginError = (err: unknown): string => {
  if (err instanceof AuthRequestError && err.status === 429) {
    return 'Login failed - Too Many Requests';
  }
  return 'Login failed';
};

const resolveBase = (scope: TransportScope = 'auth') => {
  const env = (import.meta as any).env || {};
  const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  return resolveTransportBase(scope, {
    hostname,
    hasAuthUser: Boolean(getAuthUser()),
    env,
  });
};

const fetchJson = async <T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  validate?: (data: unknown) => boolean,
  scope: TransportScope = 'auth',
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let resp: Response;
  const env = (import.meta as any).env || {};
  const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  try {
    resp = await fetch(`${resolveBase(scope)}${path}`, {
      credentials: 'include',
      cache: 'no-store',
      mode: isApexRuntime({
        hostname,
        hasAuthUser: Boolean(getAuthUser()),
        env,
      }) ? 'cors' : 'same-origin',
      redirect: 'follow',
      signal: controller.signal,
      ...init
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok || resp.status !== 200) {
    if (resp.status === 429) {
      // Typically Cloudflare (or an edge proxy) rather than app-level rate limiting.
      trackOutageEvent('outage_429_rate_limited', {
        component: 'auth-service',
        endpoint: path,
        error_code: '429',
      });
    }
    throw new AuthRequestError(resp.status);
  }
  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('auth status returned non-JSON');
  }
  const data = (await resp.json()) as unknown;
  if (!validate || validate(data)) {
    return data as T;
  }
  throw new Error('auth status payload invalid');
};

export type AuthBlog = { id: number; name: string };
export type AuthStatus = {
  user_id: number;
  blog_id: number | null;
  blog_name?: string | null;
  username?: string | null;
  blogs?: AuthBlog[];
  primary_blog_id?: number | null;
  capabilities?: string[];
};
export type AuthMe = {
  user_id: number;
  capabilities?: string[];
};
export type AuthLoginResponse = AuthStatus;
export type SettingsUser = { id: number; username?: string | null };
export type SettingsBlog = {
  id: number;
  ownerUserId?: number;
  name: string;
  title?: string;
  description?: string;
  avatarUrl?: string;
  followersCount?: number;
  postsCount?: number;
  backgroundColor?: string;
  interests?: Record<string, unknown> | null;
  personals?: { labels?: Record<string, string> } | null;
  privacy?: { isPrivate?: boolean; isPublic?: boolean } | null;
};
export type UserSettingsResponse = { user: SettingsUser; blogs: SettingsBlog[] };
export type BlogSettingsResponse = { blog: SettingsBlog };

const hasUserId = (data: unknown): boolean => {
  return typeof data === 'object' && data !== null && typeof (data as { user_id?: unknown }).user_id === 'number';
};

const hasSettingsUser = (data: unknown): boolean => {
  if (typeof data !== 'object' || data === null) return false;
  const user = (data as { user?: { id?: unknown } }).user;
  const blogs = (data as { blogs?: unknown }).blogs;
  return typeof user?.id === 'number' && Array.isArray(blogs);
};

const hasSettingsBlog = (data: unknown): boolean => {
  if (typeof data !== 'object' || data === null) return false;
  const blog = (data as { blog?: { id?: unknown } }).blog;
  return typeof blog?.id === 'number';
};

export type GetStatusOptions = {
  /** When true, always hit the network (boot revalidate). */
  force?: boolean;
};

let statusInFlight: Promise<AuthStatus> | null = null;

const fetchStatusNetwork = (): Promise<AuthStatus> => {
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return fetchJson<AuthStatus>('/status', { method: 'GET' }, timeoutMs, hasUserId)
    .then((status) => {
      writeAuthStatusCache(status);
      return status;
    })
    .catch((err: unknown) => {
      if (err instanceof AuthRequestError && (err.status === 401 || err.status === 403)) {
        clearAuthStatusCache();
      }
      throw err;
    });
};

/**
 * Read /auth/status.
 * - Default: return a fresh local snapshot when present; otherwise network.
 * - `{ force: true }`: always network (still dedupes concurrent callers).
 * Successful network reads write the snapshot; 401/403 clear it.
 */
export const getStatus = (options: GetStatusOptions = {}): Promise<AuthStatus> => {
  const force = options.force === true;
  if (!force) {
    const cached = peekAuthStatusCache();
    if (cached) {
      return Promise.resolve(cached);
    }
  }

  if (statusInFlight) {
    return statusInFlight;
  }

  statusInFlight = fetchStatusNetwork().finally(() => {
    statusInFlight = null;
  });
  return statusInFlight;
};

export { clearAuthStatusCache, peekAuthStatusCache } from './auth-status-cache.js';

export const getMe = () => {
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  // `/me` is mounted at `/v2/api/me`, not under the `/auth` prefix used by `/status`.
  return fetchJson<AuthMe>('/me', { method: 'GET' }, timeoutMs, hasUserId, 'api');
};

export const logout = () => {
  clearAuthStatusCache();
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return fetchJson<void>('/logout', { method: 'POST' }, timeoutMs).catch(() => {});
};

export const login = (loginName: string, password: string, remember = false) => {
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const body = JSON.stringify({ login: loginName, password, remember });
  return fetchJson<AuthLoginResponse>(
    '/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
    timeoutMs,
    hasUserId
  ).then((status) => {
    writeAuthStatusCache(status);
    return status;
  });
};

export const getUserSettings = (username: string) => {
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const body = JSON.stringify({ username });
  return fetchJson<UserSettingsResponse>(
    '/settings/user',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
    timeoutMs,
    hasSettingsUser
  );
};

export const getBlogSettings = (blogName: string) => {
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const body = JSON.stringify({ blogName });
  return fetchJson<BlogSettingsResponse>(
    '/settings/blog',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
    timeoutMs,
    hasSettingsBlog
  );
};
