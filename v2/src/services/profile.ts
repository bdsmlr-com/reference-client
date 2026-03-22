export type GalleryMode = 'grid' | 'masonry';

const USERNAME_KEY = 'bdsmlr_profile_username';
const GALLERY_MODE_KEY = 'bdsmlr_gallery_mode';

export const PROFILE_EVENTS = {
  galleryModeChanged: 'bdsmlr:gallery-mode-changed',
  usernameChanged: 'bdsmlr:username-changed',
} as const;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // no-op
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // no-op
  }
}

function emit(name: string, detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function getCurrentUsername(): string | null {
  const value = readStorage(USERNAME_KEY);
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function setCurrentUsername(name: string): void {
  const normalized = name.trim();
  if (!normalized) {
    clearCurrentUsername();
    return;
  }
  writeStorage(USERNAME_KEY, normalized);
  emit(PROFILE_EVENTS.usernameChanged, { username: normalized });
}

export function clearCurrentUsername(): void {
  removeStorage(USERNAME_KEY);
  emit(PROFILE_EVENTS.usernameChanged, { username: null });
}

export function clearProfileState(): void {
  removeStorage(USERNAME_KEY);
  removeStorage(GALLERY_MODE_KEY);
  emit(PROFILE_EVENTS.usernameChanged, { username: null });
  emit(PROFILE_EVENTS.galleryModeChanged, { mode: 'grid' });
}

export function isLoggedIn(): boolean {
  return Boolean(getCurrentUsername());
}

export function getGalleryMode(): GalleryMode {
  const value = readStorage(GALLERY_MODE_KEY);
  return value === 'masonry' ? 'masonry' : 'grid';
}

export function setGalleryMode(mode: GalleryMode): void {
  writeStorage(GALLERY_MODE_KEY, mode);
  emit(PROFILE_EVENTS.galleryModeChanged, { mode });
}
