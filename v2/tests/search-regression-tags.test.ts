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

  it('keeps search result rendering free of timeline item leakage', () => {
    const searchSrc = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');
    const unitsSrc = readFileSync(join(ROOT, 'services/search-result-units.ts'), 'utf8');

    expect(searchSrc).toContain("../services/search-result-units.js");
    expect(searchSrc).not.toContain("import type { PostType, PostSortField, Order, PostVariant, TimelineItem }");
    expect(searchSrc).toContain('@state() private resultUnits');
    expect(searchSrc).not.toContain('@state() private timelineItems');
    expect(searchSrc).toContain('materializeSearchResultUnits(resp)');
    expect(searchSrc).toContain('prepareSearchResultUnit(unit)');
    expect(unitsSrc).not.toContain('TimelineItem');
    expect(unitsSrc).not.toContain('materializeLegacySearchResultUnits');
    expect(unitsSrc).not.toContain('timelineItems');
  });

  it('keeps timelineItems out of the public search response contract', () => {
    const src = readFileSync(join(ROOT, 'types/api.ts'), 'utf8');
    const start = src.indexOf('export interface SearchPostsByTagResponse {');
    const end = src.indexOf('export interface ListBlogPostsResponse {');
    const searchContract = src.slice(start, end);

    expect(searchContract).not.toContain('timelineItems?: TimelineItem[];');
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

    expect(src).toContain("import { buildPageUrl, getBlogNameFromPath, getPrimaryBlogName, getUrlParam, setUrlParams } from '../services/blog-resolver.js';");
    expect(src).toContain('const routePerspectiveBlog = getBlogNameFromPath();');
    expect(src).toContain('perspective_blog_name: perspectiveBlogName');
  });

  it('adds search session url state and page-size defaults to the search route', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain('const SEARCH_PAGE_SIZE = 20;');
    expect(src).toContain("@state() private searchSessionId = '';");
    expect(src).toContain('@state() private currentPage = 1;');
    expect(src).toContain("@state() private navigationMode: 'infinite' | 'paginated' = 'infinite';");
    expect(src).toContain("const initialPage = parseSearchPageParam(getUrlParam('page'));");
    expect(src).toContain("const initialSessionId = parseSearchSessionParam(getUrlParam('session') || getUrlParam('sessionId'));");
    expect(src).toContain('const routeState = buildContentNavigationState({');
    expect(src).toContain('this.navigationMode = routeState.navigationMode;');
    expect(src).toContain(".navigationMode=${this.navigationMode}");
    expect(src).toContain(".currentPage=${this.currentPage}");
    expect(src).toContain(".hasPreviousPage=${this.currentPage > 1}");
  });

  it('threads explicit search session pagination through the API payload contract', () => {
    const searchSrc = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');
    const apiSrc = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');
    const typeSrc = readFileSync(join(ROOT, 'types/api.ts'), 'utf8');

    expect(searchSrc).toContain('session_id: this.searchSessionId || undefined');
    expect(searchSrc).toContain('page_number: targetPage');
    expect(searchSrc).toContain('page_size: SEARCH_PAGE_SIZE');
    expect(typeSrc).toContain('session_id?: string;');
    expect(typeSrc).toContain('page_number?: number;');
    expect(typeSrc).toContain('page_size?: number;');
    expect(apiSrc).toContain("session: session_id");
    expect(apiSrc).toContain("page: page_number");
    expect(apiSrc).toContain('const resolvedPageSize = req.page_size ?? req.page?.page_size;');
    expect(apiSrc).toContain('page_size: page_size ?? page?.page_size');
  });

  it('supports paginated footer controls for search navigation', () => {
    const src = readFileSync(join(ROOT, 'components/load-footer.ts'), 'utf8');
    const eventSrc = readFileSync(join(ROOT, 'types/events.ts'), 'utf8');

    expect(src).toContain("@property({ type: String }) navigationMode: 'infinite' | 'paginated' = 'infinite';");
    expect(src).toContain('@property({ type: Number }) currentPage = 1;');
    expect(src).toContain('@property({ type: Boolean }) hasPreviousPage = false;');
    expect(src).toContain('@property({ type: Boolean }) hasNextPage = false;');
    expect(src).toContain('Previous');
    expect(src).toContain('Next');
    expect(src).toContain('EventNames.PREVIOUS_PAGE');
    expect(src).toContain('EventNames.NEXT_PAGE');
    expect(eventSrc).toContain("PREVIOUS_PAGE: 'previous-page'");
    expect(eventSrc).toContain("NEXT_PAGE: 'next-page'");
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

  it('syncs variant pill highlight from selectedVariants arrays', () => {
    const src = readFileSync(join(ROOT, 'components/variant-pills.ts'), 'utf8');

    expect(src).toContain("@property({ type: Array }) selectedVariants: PostVariant[] = [];");
    expect(src).toContain("if (changed.has('selectedVariants')) {");
    expect(src).toContain("if (unique.length === 1 && unique[0] === 1) return 'original';");
    expect(src).toContain("if (unique.length === 1 && unique[0] === 2) return 'reblog';");
  });
});
