import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('search regression and tag visibility', () => {
  it('guards against stale async search responses overwriting newer query state', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('private activeSearchToken = 0;');
    expect(src).toContain('private currentSearchSignature =');
    expect(src).toContain('const searchToken = ++this.activeSearchToken;');
    expect(src).toContain('if (searchToken !== this.activeSearchToken || signature !== this.currentSearchSignature)');
  });

  it('treats posts as the canonical search payload instead of backend timelineItems', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('(resp.posts || []).forEach');
    expect(src).toContain("newItems.push({ type: 1, post });");
    expect(src).not.toContain('(resp.timelineItems || []).forEach');
  });

  it('does not collapse search results by origin post or media url', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('private seenIds = new Set<number>();');
    expect(src).not.toContain('private renderedMediaKeys = new Set<string>();');
    expect(src).not.toContain('const contentKey =');
    expect(src).toContain('if (this.seenIds.has(post.id)) {');
  });

  it('scopes cached search responses by build sha so deploys do not serve stale clear results', () => {
    const src = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');

    expect(src).not.toContain('generateSearchCacheKey');
    expect(src).not.toContain('getCachedSearchResult');
    expect(src).not.toContain('setCachedSearchResult');
  });

  it('extracts fallback tags from body/html when API tags are missing', () => {
    const src = readFileSync(join(ROOT, 'types/post.ts'), 'utf8');

    expect(src).toContain('export function extractRenderableTags(post: Post): string[]');
    expect(src).toContain("const matches = text.match(/#(");
  });

  it('shows tag count on gallery/search cards and tag chips on detail views', () => {
    const gridSrc = readFileSync(join(ROOT, 'components/activity-grid.ts'), 'utf8');
    const detailSrc = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');

    expect(gridSrc).toContain('🏷️');
    expect(gridSrc).toContain('extractRenderableTags');
    expect(detailSrc).toContain('extractRenderableTags');
    expect(detailSrc).toContain('class="post-tags"');
  });

  it('threads the search route perspective blog into the API request payload', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain("import { buildPageUrl, getBlogNameFromPath, getPrimaryBlogName, getUrlParam, setUrlParams, isDefaultTypes } from '../services/blog-resolver.js';");
    expect(src).toContain('const routePerspectiveBlog = getBlogNameFromPath();');
    expect(src).toContain('perspective_blog_name: perspectiveBlogName');
  });

  it('defaults search to original-post variants instead of all variants', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('@state() private selectedVariants: PostVariant[] = [1];');
    expect(src).toContain("variants: this.selectedVariants.length > 0 ? this.selectedVariants : undefined");
  });

  it('writes readable type and variant tokens into search urls', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('serializePostTypesParam(this.selectedTypes)');
    expect(src).toContain("serializeVariantsParam(this.selectedVariants, { emptyToken: 'all' })");
  });

  it('renders variant pills in original, reblog, all order', () => {
    const src = readFileSync(join(ROOT, 'components/variant-pills.ts'), 'utf8');

    const originalIndex = src.indexOf("this.renderButton('original'");
    const reblogIndex = src.indexOf("this.renderButton('reblog'");
    const allIndex = src.indexOf("this.renderButton('all'");

    expect(originalIndex).toBeGreaterThan(-1);
    expect(reblogIndex).toBeGreaterThan(-1);
    expect(allIndex).toBeGreaterThan(-1);
    expect(originalIndex).toBeLessThan(reblogIndex);
    expect(reblogIndex).toBeLessThan(allIndex);
  });
});
