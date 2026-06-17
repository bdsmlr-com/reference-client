export interface SocialSortOption {
  value: string;
  label: string;
}

export const SOCIAL_SORT_OPTIONS: SocialSortOption[] = [];

export function normalizeSocialSortValue(_value: string | null | undefined): string {
  return 'default';
}
