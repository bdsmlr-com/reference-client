import type { AuthStatus } from './auth-service.js';

const CACHE_KEY = 'bdsmlr_auth_status_v1';

/** How long a successful /status snapshot stays "fresh" for non-forced reads. */
export const AUTH_STATUS_TTL_MS = 10 * 60 * 1000;

type AuthStatusCacheEnvelope = {
  savedAt: number;
  status: AuthStatus;
};

function isAuthStatus(data: unknown): data is AuthStatus {
  return typeof data === 'object' && data !== null && typeof (data as { user_id?: unknown }).user_id === 'number';
}

function isEnvelope(data: unknown): data is AuthStatusCacheEnvelope {
  if (typeof data !== 'object' || data === null) return false;
  const savedAt = (data as { savedAt?: unknown }).savedAt;
  const status = (data as { status?: unknown }).status;
  return typeof savedAt === 'number' && isAuthStatus(status);
}

function readStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Return a still-fresh cached /status payload, or null.
 * Does not hit the network.
 */
export function peekAuthStatusCache(now = Date.now()): AuthStatus | null {
  const storage = readStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) {
      storage.removeItem(CACHE_KEY);
      return null;
    }
    if (now > parsed.savedAt + AUTH_STATUS_TTL_MS) {
      // Expired: drop so we don't keep serving a zombie after the next clear path.
      storage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.status;
  } catch {
    try {
      storage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

/** Persist a successful /status (or login) payload. */
export function writeAuthStatusCache(status: AuthStatus, now = Date.now()): void {
  if (!isAuthStatus(status)) return;
  const storage = readStorage();
  if (!storage) return;
  try {
    const envelope: AuthStatusCacheEnvelope = { savedAt: now, status };
    storage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Quota / private mode — ignore; network path still works.
  }
}

/** Drop the snapshot (logout, 401, status mismatch recovery). */
export function clearAuthStatusCache(): void {
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
