import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('search route perspective wiring', () => {
  it('threads the route blog perspective into the search request payload', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain("import { buildPageUrl, getBlogNameFromPath, getPrimaryBlogName, getUrlParam, setUrlParams, isDefaultTypes } from '../services/blog-resolver.js';");
    expect(src).toContain('perspective_blog_name');
    expect(src).toContain('const routePerspectiveBlog = getBlogNameFromPath();');
    expect(src).toContain("const explicitSort = !!getUrlParam('sort');");
    expect(src).toContain("const matchMode = routePerspectiveBlog ? this.matchMode : 'off';");
    expect(src).toContain("const facetMode = matchMode === 'hard'");
    expect(src).toContain("matchMode === 'soft' ? (explicitSort ? 'require' : 'boost') : undefined");
    expect(src).toContain('const perspectiveBlogName = (facetMode || hasFacetTuning) ? (routePerspectiveBlog || undefined) : undefined;');
    expect(src).toContain('perspective_blog_name: perspectiveBlogName');
    expect(src).toContain('facetMode,');
    expect(src).toContain('tag_name: this.query');
  });

  it('does not force a saved sort preference into the URL when sort was implicit', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('@state() private sortValue = \'newest\';');
    expect(src).toContain('@state() private matchMode: \'off\' | \'soft\' | \'hard\' = \'off\';');
    expect(src).toContain('private sortExplicitInUrl = false;');
    expect(src).toContain("this.sortExplicitInUrl = !!sort;");
    expect(src).toContain("sort: this.sortExplicitInUrl ? this.sortValue : ''");
    expect(src).toContain("match: routePerspectiveBlog && this.matchMode !== 'off' ? this.matchMode : ''");
    expect(src).toContain('this.sortExplicitInUrl = true;');
  });

  it('supports dev-only facet tuning query params on search', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain("if (ACTIVE_ENV !== 'dev') return {};");
    expect(src).toContain("const facetMode = getUrlParam('facet_mode') || getUrlParam('facetMode');");
    expect(src).toContain('const hasFacetTuning = Object.keys(facetTuning).length > 0;');
    expect(src).toContain('const perspectiveBlogName = (facetMode || hasFacetTuning) ? (routePerspectiveBlog || undefined) : undefined;');
    expect(src).toContain('...facetTuning,');
  });

  it('shows a public Match control on profiled search routes', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain("const match = getUrlParam('match');");
    expect(src).toContain("if (match === 'soft' || match === 'hard' || match === 'off') this.matchMode = match;");
    expect(src).toContain('Match');
    expect(src).toContain('Use your profile to shape results.');
    expect(src).toContain("Use @${routePerspectiveBlog}'s profile to shape results.");
  });

  it('shows a for-you teaser group on empty search state', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('void this.loadTeasers();');
    expect(src).toContain("getRecommendedPostsForUser(subjectBlog, 6)");
    expect(src).toContain(".title=${'For You'}");
    expect(src).toContain("A teaser of personalized results while you refine your search.");
    expect(src).toContain(".actionHref=${buildPageUrl('for', getBlogNameFromPath() || getPrimaryBlogName() || '')}");
  });
});
