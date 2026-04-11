const AVATAR_CDN_HOST = 'cdn012.bdsmlr.com';
const LEGACY_AVATAR_HOST = 'ocdn012.bdsmlr.com';

export function normalizeAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;

  let normalized = avatarUrl.trim();
  if (!normalized) return null;

  if (normalized.includes(LEGACY_AVATAR_HOST)) {
    normalized = normalized.replace(LEGACY_AVATAR_HOST, AVATAR_CDN_HOST);
  }

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  const path = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  return `https://${AVATAR_CDN_HOST}/${path}`;
}

export function handleAvatarImageError(e: Event): void {
  const img = e.target as HTMLImageElement;
  const src = img.src;

  if (src.includes(LEGACY_AVATAR_HOST) && !img.dataset.triedFallback) {
    img.dataset.triedFallback = 'true';
    img.src = src.replace(LEGACY_AVATAR_HOST, AVATAR_CDN_HOST);
    return;
  }

  if (!img.dataset.showedPlaceholder) {
    img.dataset.showedPlaceholder = 'true';
    img.style.display = 'none';
    const placeholder = img.nextElementSibling;
    if (placeholder) {
      (placeholder as HTMLElement).style.display = 'flex';
    }
  }
}
