const AVATAR_CDN_HOST = 'cdn012.bdsmlr.com';
const LEGACY_AVATAR_HOST = 'ocdn012.bdsmlr.com';

function normalizeDirectLegacyAvatarHost(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === LEGACY_AVATAR_HOST) {
      parsed.hostname = AVATAR_CDN_HOST;
      return parsed.toString();
    }
  } catch {
    return url;
  }
  return url;
}

export function normalizeAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;

  let normalized = avatarUrl.trim();
  if (!normalized) return null;

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalizeDirectLegacyAvatarHost(normalized);
  }

  const path = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  return `https://${AVATAR_CDN_HOST}/${path}`;
}

export function handleAvatarImageError(e: Event): void {
  const img = e.target as HTMLImageElement;
  const src = img.src;
  const fallbackSrc = normalizeDirectLegacyAvatarHost(src);

  if (fallbackSrc !== src && !img.dataset.triedFallback) {
    img.dataset.triedFallback = 'true';
    img.src = fallbackSrc;
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
