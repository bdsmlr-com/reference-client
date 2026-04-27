const DEFAULT_BASE = '/api/v2/auth';
const DEFAULT_TIMEOUT_MS = 4000;

const resolveBase = () => {
  const env = (import.meta as any).env || {};
  const apiBase = env.VITE_AUTH_BASE || DEFAULT_BASE;
  return apiBase.replace(/\/$/, '');
};

const fetchJson = async <T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  validate?: (data: unknown) => boolean
): Promise<T> => {
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
  const data = (await resp.json()) as unknown;
  if (!validate || validate(data)) {
    return data as T;
  }
  throw new Error('auth status payload invalid');
};

export type AuthBlog = { id: number; name: string };
export type AuthStatus = { user_id: number; blog_id: number | null; blog_name?: string | null; username?: string | null; blogs?: AuthBlog[]; primary_blog_id?: number | null };
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

export const getStatus = () => {
  const env = (import.meta as any).env || {};
  const timeoutMs = Number(env.VITE_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return fetchJson<AuthStatus>('/status', { method: 'GET' }, timeoutMs, hasUserId);
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
    timeoutMs,
    hasUserId
  );
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
