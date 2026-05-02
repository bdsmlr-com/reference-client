import type { PostType, PostVariant } from '../types/api.js';

export const ALL_POST_TYPES: PostType[] = [1, 2, 3, 4, 5, 6, 7];

export const TYPE_NAME_TO_ENUM: Record<string, PostType> = {
  text: 1,
  image: 2,
  video: 3,
  audio: 4,
  link: 5,
  chat: 6,
  quote: 7,
};

export const TYPE_ENUM_TO_NAME: Record<number, string> = {
  1: 'text',
  2: 'image',
  3: 'video',
  4: 'audio',
  5: 'link',
  6: 'chat',
  7: 'quote',
};

export const VARIANT_NAME_TO_ENUM: Record<string, PostVariant> = {
  original: 1,
  reblog: 2,
};

export const VARIANT_ENUM_TO_NAME: Record<number, string> = {
  1: 'original',
  2: 'reblog',
};

function uniqueFiniteInts<T extends number>(values: T[]): T[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))];
}

export function parsePostTypesParam(raw: string | null | undefined): PostType[] | null {
  if (!raw) return null;
  const parsed = raw
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .map((token) => TYPE_NAME_TO_ENUM[token] ?? (parseInt(token, 10) as PostType));
  const normalized = uniqueFiniteInts(parsed);
  return normalized.length > 0 ? normalized : null;
}

export function serializePostTypesParam(types: PostType[]): string {
  return uniqueFiniteInts(types).map((type) => TYPE_ENUM_TO_NAME[type] || String(type)).join(',');
}

export function parseVariantsParam(raw: string | null | undefined): PostVariant[] | null {
  if (!raw) return null;
  const lowered = raw.trim().toLowerCase();
  if (lowered === 'all') return [];
  const parsed = lowered
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => VARIANT_NAME_TO_ENUM[token] ?? (parseInt(token, 10) as PostVariant));
  const normalized = uniqueFiniteInts(parsed);
  return normalized.length > 0 ? normalized : null;
}

export function serializeVariantsParam(
  variants: PostVariant[],
  options: { emptyToken?: string } = {},
): string {
  const { emptyToken = '' } = options;
  const normalized = uniqueFiniteInts(variants);
  if (normalized.length === 0) return emptyToken;
  return normalized.map((variant) => VARIANT_ENUM_TO_NAME[variant] || String(variant)).join(',');
}
