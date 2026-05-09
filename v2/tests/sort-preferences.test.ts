import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('sort preference persistence', () => {
  it('profile service exposes separate archive/search sort preferences', () => {
    const src = readFileSync(join(ROOT, 'services/profile.ts'), 'utf8');

    expect(src).toContain('const ARCHIVE_SORT_KEY =');
    expect(src).toContain('const SEARCH_SORT_KEY =');
    expect(src).toContain('const SOCIAL_SORT_KEY =');
    expect(src).toContain('export function getArchiveSortPreference()');
    expect(src).toContain('export function setArchiveSortPreference(');
    expect(src).toContain('export function getSearchSortPreference()');
    expect(src).toContain('export function setSearchSortPreference(');
    expect(src).toContain('export function getSocialSortPreference()');
    expect(src).toContain('export function setSocialSortPreference(');
  });

  it('archive and search use persisted sort defaults when URL sort is absent', () => {
    const archiveSrc = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(archiveSrc).toContain('const resolvedSort = normalizeSortValue(sort || getArchiveSortPreference());');
    expect(searchSrc).toContain('const resolvedSort = normalizeSortValue(sort || getSearchSortPreference());');
    expect(archiveSrc).toContain('setArchiveSortPreference(this.sortValue);');
    expect(searchSrc).toContain('setSearchSortPreference(this.sortValue);');
  });

  it('settings page now owns archive and search default sort controls', () => {
    const settingsSrc = readFileSync(join(ROOT, 'pages/view-settings-user.ts'), 'utf8');
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');

    expect(settingsSrc).toContain('setArchiveSortPreference');
    expect(settingsSrc).toContain('setSearchSortPreference');
    expect(settingsSrc).toContain('setSocialSortPreference');
    expect(settingsSrc).toContain("this.renderRoutePreferenceRow('archive'");
    expect(settingsSrc).toContain("this.renderRoutePreferenceRow('search'");
    expect(settingsSrc).toContain("this.renderRoutePreferenceRow('social'");
    expect(settingsSrc).toContain('showSort: true');
    expect(navSrc).not.toContain('Archive default sort');
    expect(navSrc).not.toContain('Search default sort');
  });

  it('social route uses persisted social sort defaults when URL sort is absent', () => {
    const socialSrc = readFileSync(join(ROOT, 'pages/view-social.ts'), 'utf8');

    expect(socialSrc).toContain("import { getSocialSortPreference, setSocialSortPreference } from '../services/profile.js';");
    expect(socialSrc).toContain("@state() private sortValue = 'default';");
    expect(socialSrc).toContain("this.sortValue = getUrlParam('sort') || getSocialSortPreference() || 'default';");
    expect(socialSrc).toContain('setSocialSortPreference(this.sortValue);');
    expect(socialSrc).toContain('.showSort=${true}');
  });

  it('feed route no longer highlights Activity tab', () => {
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');
    expect(navSrc).toContain("this.currentPage === 'following' || this.currentPage === 'follower-feed'");
  });
});
