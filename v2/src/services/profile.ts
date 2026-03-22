export type GalleryMode = 'grid' | 'masonry';
export type ActivityKind = 'post' | 'reblog' | 'like' | 'comment';

const USERNAME_KEY = 'bdsmlr_profile_username';
const GALLERY_MODE_KEY = 'bdsmlr_gallery_mode';
const ARCHIVE_SORT_KEY = 'bdsmlr_archive_sort';
const SEARCH_SORT_KEY = 'bdsmlr_search_sort';
const FOLLOWING_ACTIVITY_KINDS_KEY = 'bdsmlr_following_activity_kinds';
const BLOG_ACTIVITY_KINDS_KEY = 'bdsmlr_blog_activity_kinds';

export const PROFILE_EVENTS = {
  galleryModeChanged: 'bdsmlr:gallery-mode-changed',
  usernameChanged: 'bdsmlr:username-changed',
  sortPreferencesChanged: 'bdsmlr:sort-preferences-changed',
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
  removeStorage(ARCHIVE_SORT_KEY);
  removeStorage(SEARCH_SORT_KEY);
  removeStorage(FOLLOWING_ACTIVITY_KINDS_KEY);
  removeStorage(BLOG_ACTIVITY_KINDS_KEY);
  emit(PROFILE_EVENTS.usernameChanged, { username: null });
  emit(PROFILE_EVENTS.galleryModeChanged, { mode: 'grid' });
  emit(PROFILE_EVENTS.sortPreferencesChanged, { archiveSort: null, searchSort: null });
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

export function getArchiveSortPreference(): string | null {
  return readStorage(ARCHIVE_SORT_KEY);
}

export function setArchiveSortPreference(sortValue: string): void {
  writeStorage(ARCHIVE_SORT_KEY, sortValue);
  emit(PROFILE_EVENTS.sortPreferencesChanged, {
    archiveSort: sortValue,
    searchSort: getSearchSortPreference(),
  });
}

export function getSearchSortPreference(): string | null {
  return readStorage(SEARCH_SORT_KEY);
}

export function setSearchSortPreference(sortValue: string): void {
  writeStorage(SEARCH_SORT_KEY, sortValue);
  emit(PROFILE_EVENTS.sortPreferencesChanged, {
    archiveSort: getArchiveSortPreference(),
    searchSort: sortValue,
  });
}

function normalizeActivityKinds(input: string | null, fallback: ActivityKind[]): ActivityKind[] {
  if (!input) return fallback;
  const allowed: ActivityKind[] = ['post', 'reblog', 'like', 'comment'];
  const list = input
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is ActivityKind => allowed.includes(v as ActivityKind));
  return list.length > 0 ? list : fallback;
}

export function getFollowingActivityKindsPreference(): ActivityKind[] {
  return normalizeActivityKinds(readStorage(FOLLOWING_ACTIVITY_KINDS_KEY), ['post', 'reblog', 'like', 'comment']);
}

export function setFollowingActivityKindsPreference(kinds: ActivityKind[]): void {
  writeStorage(FOLLOWING_ACTIVITY_KINDS_KEY, kinds.join(','));
}

export function getBlogActivityKindsPreference(): ActivityKind[] {
  return normalizeActivityKinds(readStorage(BLOG_ACTIVITY_KINDS_KEY), ['post', 'reblog', 'like', 'comment']);
}

export function setBlogActivityKindsPreference(kinds: ActivityKind[]): void {
  writeStorage(BLOG_ACTIVITY_KINDS_KEY, kinds.join(','));
}
