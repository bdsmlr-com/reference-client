export type GalleryMode = 'grid' | 'masonry';
export type ActivityKind = 'post' | 'reblog' | 'like' | 'comment';
export const DEFAULT_ACTIVITY_KINDS: ActivityKind[] = ['post', 'reblog', 'like', 'comment'];

const USERNAME_KEY = 'bdsmlr_profile_username';
const GALLERY_MODE_KEY = 'bdsmlr_gallery_mode';
const ARCHIVE_SORT_KEY = 'bdsmlr_archive_sort';
const SEARCH_SORT_KEY = 'bdsmlr_search_sort';
const SOCIAL_SORT_KEY = 'bdsmlr_social_sort';
const FOLLOWING_ACTIVITY_KINDS_KEY = 'bdsmlr_following_activity_kinds';
const FOLLOWER_FEED_ACTIVITY_KINDS_KEY = 'bdsmlr_follower_feed_activity_kinds';
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

function getScopedKey(key: string, scope?: string): string {
  return scope ? `${key}:${scope}` : key;
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
  removeStorage(getScopedKey(GALLERY_MODE_KEY, 'search'));
  removeStorage(getScopedKey(GALLERY_MODE_KEY, 'archive'));
  removeStorage(ARCHIVE_SORT_KEY);
  removeStorage(SEARCH_SORT_KEY);
  removeStorage(SOCIAL_SORT_KEY);
  removeStorage(FOLLOWING_ACTIVITY_KINDS_KEY);
  removeStorage(FOLLOWER_FEED_ACTIVITY_KINDS_KEY);
  removeStorage(BLOG_ACTIVITY_KINDS_KEY);
  emit(PROFILE_EVENTS.usernameChanged, { username: null });
  emit(PROFILE_EVENTS.galleryModeChanged, { mode: 'grid' });
  emit(PROFILE_EVENTS.sortPreferencesChanged, { archiveSort: null, searchSort: null });
}

export function isLoggedIn(): boolean {
  return Boolean(getCurrentUsername());
}

export function getGalleryMode(scope?: string): GalleryMode {
  const value = readStorage(getScopedKey(GALLERY_MODE_KEY, scope));
  return value === 'masonry' ? 'masonry' : 'grid';
}

export function setGalleryMode(mode: GalleryMode, scope?: string): void {
  writeStorage(getScopedKey(GALLERY_MODE_KEY, scope), mode);
  emit(PROFILE_EVENTS.galleryModeChanged, { mode, scope: scope || null });
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

export function getSocialSortPreference(): string | null {
  return readStorage(SOCIAL_SORT_KEY);
}

export function setSocialSortPreference(sortValue: string): void {
  writeStorage(SOCIAL_SORT_KEY, sortValue);
  emit(PROFILE_EVENTS.sortPreferencesChanged, {
    archiveSort: getArchiveSortPreference(),
    searchSort: getSearchSortPreference(),
    socialSort: sortValue,
  });
}

export function normalizeActivityKinds(input: string | null, fallback: ActivityKind[] = DEFAULT_ACTIVITY_KINDS): ActivityKind[] {
  if (!input) return fallback;
  const allowed: ActivityKind[] = DEFAULT_ACTIVITY_KINDS;
  const list = input
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is ActivityKind => allowed.includes(v as ActivityKind));
  return list.length > 0 ? list : fallback;
}

export function getFollowingActivityKindsPreference(): ActivityKind[] {
  return normalizeActivityKinds(readStorage(FOLLOWING_ACTIVITY_KINDS_KEY), DEFAULT_ACTIVITY_KINDS);
}

export function setFollowingActivityKindsPreference(kinds: ActivityKind[]): void {
  writeStorage(FOLLOWING_ACTIVITY_KINDS_KEY, kinds.join(','));
}

export function getFollowerFeedActivityKindsPreference(): ActivityKind[] {
  return normalizeActivityKinds(readStorage(FOLLOWER_FEED_ACTIVITY_KINDS_KEY), DEFAULT_ACTIVITY_KINDS);
}

export function setFollowerFeedActivityKindsPreference(kinds: ActivityKind[]): void {
  writeStorage(FOLLOWER_FEED_ACTIVITY_KINDS_KEY, kinds.join(','));
}

export function getBlogActivityKindsPreference(): ActivityKind[] {
  return normalizeActivityKinds(readStorage(BLOG_ACTIVITY_KINDS_KEY), DEFAULT_ACTIVITY_KINDS);
}

export function setBlogActivityKindsPreference(kinds: ActivityKind[]): void {
  writeStorage(BLOG_ACTIVITY_KINDS_KEY, kinds.join(','));
}
