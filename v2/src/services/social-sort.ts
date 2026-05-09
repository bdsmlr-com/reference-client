import type { FollowEdge } from '../types/api.js';

export interface SocialSortOption {
  value: string;
  label: string;
}

export const SOCIAL_SORT_OPTIONS: SocialSortOption[] = [
  { value: 'default', label: 'Default' },
  { value: 'name:asc', label: 'Alphabetical (A-Z)' },
  { value: 'name:desc', label: 'Alphabetical (Z-A)' },
  { value: 'followers:desc', label: 'Most followers' },
  { value: 'followers:asc', label: 'Fewest followers' },
  { value: 'posts:desc', label: 'Most posts' },
  { value: 'posts:asc', label: 'Fewest posts' },
  { value: 'latest-post:desc', label: 'Most recently posted' },
  { value: 'latest-post:asc', label: 'Least recently posted' },
  { value: 'created:desc', label: 'Newest blog first' },
  { value: 'created:asc', label: 'Oldest blog first' },
];

export function normalizeSocialSortValue(value: string | null | undefined): string {
  return SOCIAL_SORT_OPTIONS.some((option) => option.value === value) ? String(value) : 'default';
}

function compareText(a: string | undefined, b: string | undefined): number {
  return (a || '').localeCompare(b || '', undefined, { sensitivity: 'base' });
}

function compareNumber(a: number | undefined, b: number | undefined): number {
  return (a || 0) - (b || 0);
}

function compareDateString(a: string | undefined, b: string | undefined): number {
  const aTime = a ? Date.parse(a) || 0 : 0;
  const bTime = b ? Date.parse(b) || 0 : 0;
  return aTime - bTime;
}

export function sortSocialEdges(items: FollowEdge[], sortValue: string): FollowEdge[] {
  const normalized = normalizeSocialSortValue(sortValue);
  if (normalized === 'default') {
    return items;
  }

  const sorted = [...items];
  sorted.sort((left, right) => {
    switch (normalized) {
      case 'name:asc':
        return compareText(left.blogName, right.blogName) || compareNumber(left.blogId, right.blogId);
      case 'name:desc':
        return compareText(right.blogName, left.blogName) || compareNumber(right.blogId, left.blogId);
      case 'followers:desc':
        return compareNumber(right.followersCount, left.followersCount) || compareText(left.blogName, right.blogName);
      case 'followers:asc':
        return compareNumber(left.followersCount, right.followersCount) || compareText(left.blogName, right.blogName);
      case 'posts:desc':
        return compareNumber(right.postsCount, left.postsCount) || compareText(left.blogName, right.blogName);
      case 'posts:asc':
        return compareNumber(left.postsCount, right.postsCount) || compareText(left.blogName, right.blogName);
      case 'latest-post:desc':
        return compareNumber(right.latestPostCreatedAtUnix, left.latestPostCreatedAtUnix) || compareText(left.blogName, right.blogName);
      case 'latest-post:asc':
        return compareNumber(left.latestPostCreatedAtUnix, right.latestPostCreatedAtUnix) || compareText(left.blogName, right.blogName);
      case 'created:desc':
        return compareDateString(right.createdAt, left.createdAt) || compareText(left.blogName, right.blogName);
      case 'created:asc':
        return compareDateString(left.createdAt, right.createdAt) || compareText(left.blogName, right.blogName);
      default:
        return 0;
    }
  });
  return sorted;
}
