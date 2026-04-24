import { normalizeAvatarUrl } from './avatar-url';
import type { Blog, BlogInterests, BlogPersonals, BlogPrivacy } from '../types/api';

export type BlogPresentationMode = 'public' | 'settings';

export interface BlogPresentationChip {
  kind: 'interest' | 'personal' | 'privacy';
  label: string;
  value?: string;
}

export interface BlogPresentationIdentity {
  blogName: string;
  blogLabel: string;
  title: string;
  avatarUrl: string | null;
  initial: string;
  accentColor: string;
}

export interface BlogPresentationStats {
  followersCount: number;
  postsCount: number;
}

export interface BlogPresentationPrivacy {
  summary: string | null;
  chips: BlogPresentationChip[];
}

export interface BlogPresentation {
  mode: BlogPresentationMode;
  identity: BlogPresentationIdentity;
  chips: BlogPresentationChip[];
  privacy: BlogPresentationPrivacy;
  stats: BlogPresentationStats | null;
}

const INTEREST_LABELS: Record<keyof BlogInterests, string> = {
  maledom: 'Male dom',
  femdom: 'Fem dom',
  lesbian: 'Lesbian',
  gay: 'Gay',
  sissy: 'Sissy',
  latex: 'Latex',
  gifs: 'GIFs',
  extreme: 'Extreme',
  vanilla: 'Vanilla',
  vintage: 'Vintage',
  art: 'Art',
  funny: 'Funny',
  hentai: 'Hentai',
  journal: 'Journal',
  quotes: 'Quotes',
  cartoon: 'Cartoon',
  other: 'Other',
};

const BLOG_PRIVACY_LABELS: Record<keyof BlogPrivacy, string> = {
  isPrivate: 'Private',
  isPublic: 'Public',
};

function normalizeBlogName(blogName: string | null | undefined): string {
  return (blogName ?? '').trim().replace(/^@+/, '');
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function deriveAccentColor(blogName: string, explicitAccentColor?: string | null): string {
  const explicit = explicitAccentColor?.trim();
  if (explicit) {
    return explicit;
  }

  const normalized = normalizeBlogName(blogName) || 'blog';
  const hue = hashString(normalized) % 360;
  return `hsl(${hue} 64% 46%)`;
}

function buildInitial(blogName: string): string {
  const normalized = normalizeBlogName(blogName);
  return (normalized.charAt(0) || '?').toUpperCase();
}

function buildInterestChips(interests?: BlogInterests): BlogPresentationChip[] {
  if (!interests) return [];

  return (Object.keys(INTEREST_LABELS) as Array<keyof BlogInterests>)
    .filter((key) => Boolean(interests[key]))
    .map((key) => ({
      kind: 'interest',
      label: INTEREST_LABELS[key],
    }));
}

function buildPersonalChips(personals?: BlogPersonals): BlogPresentationChip[] {
  const labels = personals?.labels;
  if (!labels) return [];

  return Object.entries(labels)
    .flatMap(([label, value]) => {
      if (typeof value !== 'string') {
        return [];
      }

      const normalizedValue = value.trim();
      if (!normalizedValue) {
        return [];
      }

      return [{
        kind: 'personal' as const,
        label: typeof label === 'string' && label.trim() ? label.trim() : 'Label',
        value: normalizedValue,
      }];
    });
}

function buildPrivacySummary(privacy?: BlogPrivacy): string | null {
  if (!privacy) return null;
  if (privacy.isPrivate) return 'Private blog';
  if (privacy.isPublic) return 'Public blog';
  return 'Privacy status unknown';
}

function buildPrivacyChips(privacy?: BlogPrivacy): BlogPresentationChip[] {
  if (!privacy) return [];

  return (Object.keys(BLOG_PRIVACY_LABELS) as Array<keyof BlogPrivacy>)
    .filter((key) => Boolean(privacy[key]))
    .map((key) => ({
      kind: 'privacy' as const,
      label: BLOG_PRIVACY_LABELS[key],
      value: 'Enabled',
    }));
}

function buildStats(blog: Blog, mode: BlogPresentationMode): BlogPresentationStats | null {
  if (mode !== 'settings') {
    return null;
  }

  return {
    followersCount: blog.followersCount ?? 0,
    postsCount: blog.postsCount ?? 0,
  };
}

export function buildBlogPresentation(blog: Blog, mode: BlogPresentationMode): BlogPresentation {
  const blogName = normalizeBlogName(blog.name) || 'blog';
  const title = (typeof blog.title === 'string' ? blog.title : '').trim();
  const identity = {
    blogName,
    blogLabel: `@${blogName}`,
    title,
    avatarUrl: normalizeAvatarUrl(blog.avatarUrl ?? null),
    initial: buildInitial(blogName),
    accentColor: deriveAccentColor(blogName, blog.accentColor),
  };

  const interestChips = buildInterestChips(blog.interests);
  const personalChips = buildPersonalChips(blog.personals);
  const privacyChips = mode === 'settings' ? buildPrivacyChips(blog.privacy) : [];

  return {
    mode,
    identity,
    chips: [...interestChips, ...personalChips, ...privacyChips],
    privacy: {
      summary: mode === 'settings' ? buildPrivacySummary(blog.privacy) : null,
      chips: privacyChips,
    },
    stats: buildStats(blog, mode),
  };
}
