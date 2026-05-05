import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('sort preference persistence', () => {
  it('profile service exposes separate archive/search sort preferences', () => {
    const src = readFileSync(join(ROOT, 'services/profile.ts'), 'utf8');

    expect(src).toContain('const ARCHIVE_SORT_KEY =');
    expect(src).toContain('const SEARCH_SORT_KEY =');
    expect(src).toContain('export function getArchiveSortPreference()');
    expect(src).toContain('export function setArchiveSortPreference(');
    expect(src).toContain('export function getSearchSortPreference()');
    expect(src).toContain('export function setSearchSortPreference(');
  });

  it('archive and search use persisted sort defaults when URL sort is absent', () => {
    const archiveSrc = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(archiveSrc).toContain('const resolvedSort = normalizeSortValue(sort || getArchiveSortPreference());');
    expect(searchSrc).toContain('const resolvedSort = normalizeSortValue(sort || getSearchSortPreference());');
    expect(archiveSrc).toContain('setArchiveSortPreference(this.sortValue);');
    expect(searchSrc).toContain('setSearchSortPreference(this.sortValue);');
    expect(archiveSrc).toContain("activity_kinds: ['post', 'reblog']");
  });

  it('settings menu exposes archive and search default sort controls', () => {
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');

    expect(navSrc).toContain('Archive default sort');
    expect(navSrc).toContain('Search default sort');
    expect(navSrc).toContain('handleArchiveSortPreferenceChange');
    expect(navSrc).toContain('handleSearchSortPreferenceChange');
  });

  it('feed route no longer highlights Activity tab', () => {
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');
    expect(navSrc).toContain("this.currentPage === 'following' || this.currentPage === 'follower-feed'");
  });
});
