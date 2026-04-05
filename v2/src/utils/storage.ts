const ACTIVE_BLOG_KEY_PREFIX = 'activeBlog:';

const makeKey = (userId: number | string) => `${ACTIVE_BLOG_KEY_PREFIX}${userId}`;

export function getStoredActiveBlog(userId: number | string): number | null {
  const raw = localStorage.getItem(makeKey(userId));
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setStoredActiveBlog(userId: number | string, blogId: number): void {
  localStorage.setItem(makeKey(userId), String(blogId));
}

export function clearStoredActiveBlog(userId: number | string): void {
  localStorage.removeItem(makeKey(userId));
}
