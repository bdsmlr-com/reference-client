import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

vi.mock('lit', () => ({
  LitElement: class LitElement {},
  html: (strings: TemplateStringsArray | readonly string[], ...values: unknown[]) => ({ strings, values }),
  css: (strings: TemplateStringsArray | readonly string[], ...values: unknown[]) => ({ strings, values }),
}));

vi.mock('lit/decorators.js', () => ({
  customElement: () => (value: unknown) => value,
  property: () => () => undefined,
  state: () => () => undefined,
}));

vi.mock('../src/styles/theme.js', () => ({
  baseStyles: [],
}));

vi.mock('../src/services/client.js', () => ({
  apiClient: {
    identity: { resolveNameToId: vi.fn() },
    posts: { searchCached: vi.fn() },
  },
}));

vi.mock('../src/services/api-error.js', () => ({
  getContextualErrorMessage: vi.fn(() => 'error'),
  ErrorMessages: {
    VALIDATION: { NO_BLOG_SPECIFIED: 'no blog', NO_TYPES_SELECTED: 'no types' },
    BLOG: { notFound: (blog: string) => `${blog} missing` },
  },
  isApiError: vi.fn(() => false),
  toApiError: vi.fn(() => ({ isRetryable: false })),
}));

vi.mock('../src/services/blog-resolver.js', () => ({
  getUrlParam: vi.fn(() => null),
  setUrlParams: vi.fn(),
  isBlogInPath: vi.fn(() => true),
  isDefaultTypes: vi.fn(() => false),
  isAdminMode: vi.fn(() => false),
}));

vi.mock('../src/services/blog-theme.js', () => ({
  initBlogTheme: vi.fn(),
  clearBlogTheme: vi.fn(),
}));

vi.mock('../src/services/post-filter-url.js', () => ({
  parsePostTypesParam: vi.fn(() => null),
  parseVariantsParam: vi.fn(() => null),
  serializePostTypesParam: vi.fn(() => '1,2,3'),
  serializeVariantsParam: vi.fn(() => '1'),
}));

vi.mock('../src/services/scroll-observer.js', () => ({
  scrollObserver: {
    observe: vi.fn(),
    unobserve: vi.fn(),
  },
}));

vi.mock('../src/services/storage.js', () => ({
  getInfiniteScrollPreference: vi.fn(() => false),
  setCachedPaginationCursor: vi.fn(),
  generatePaginationCursorKey: vi.fn(() => 'archive-key'),
}));

vi.mock('../src/services/profile.js', () => ({
  getGalleryMode: vi.fn(() => 'grid'),
  PROFILE_EVENTS: {},
  getArchiveSortPreference: vi.fn(() => 'newest'),
  setArchiveSortPreference: vi.fn(),
}));

vi.mock('../src/services/post-presentation.js', () => ({
  toPresentationModel: vi.fn(() => ({ identity: { isReblog: false } })),
}));

vi.mock('../src/services/render-page.js', () => ({
  getPageSlotConfig: vi.fn(() => ({ loading: { cardType: '', count: 0 } })),
}));

vi.mock('../src/config.js', () => ({
  RenderSlotConfig: class {},
}));

vi.mock('../src/services/search-result-units.js', () => ({
  materializeSearchResultUnits: vi.fn((resp: { posts?: unknown[] }) =>
    (resp.posts || []).map((post) => ({ kind: 'post', post })),
  ),
}));

vi.mock('../src/components/filter-bar.js', () => ({}));
vi.mock('../src/components/control-panel.js', () => ({}));
vi.mock('../src/components/activity-grid.js', () => ({}));
vi.mock('../src/components/load-footer.js', () => ({}));
vi.mock('../src/components/loading-spinner.js', () => ({}));
vi.mock('../src/components/skeleton-loader.js', () => ({}));
vi.mock('../src/components/error-state.js', () => ({}));
vi.mock('../src/components/blog-header.js', () => ({}));
vi.mock('../src/components/render-card.js', () => ({}));
vi.mock('../src/components/archive-when-picker.js', () => ({}));

const { ViewArchive } = await import('../src/pages/view-archive.js');
const { apiClient } = await import('../src/services/client.js');

describe('archive pagination mode', () => {
  it('forces paginated mode when explicit archive page, cursor, or when state is present', () => {
    const src = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(src).toContain("private navigationMode: 'infinite' | 'paginated' = 'infinite'");
    expect(src).toContain('readContentRouteUrlState({');
    expect(src).toContain('buildContentRouteLoadState({');
    expect(src).toContain('forcePaginatedContentRouteNavigation(this.infiniteScroll)');
    expect(src).toContain('this.forcedPaginatedFromUrl = forcePaginatedFromUrl;');
  });

  it('uses archive page/session state instead of the old cursor walk', () => {
    const src = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(src).toContain('buildContentRouteUrlParams({');
    expect(src).toContain('sessionId: this.searchSessionId');
    expect(src).not.toContain('resolveArchivePageCursor');
    expect(src).not.toContain('currentPageCursor');
    expect(src).not.toContain('pageStartCursors');
  });

  it('renders the archive when control through the shared control panel', () => {
    const archiveSrc = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(archiveSrc).toContain("import '../components/control-panel.js';");
    expect(archiveSrc).toContain('<control-panel');
    expect(archiveSrc).toContain('.blog=${this.blogData}');
    expect(archiveSrc).toContain('.whenValue=${this.archiveWhen}');
    expect(archiveSrc).toContain('.showWhen=${true}');
    expect(archiveSrc).toContain('@when-change=${this.handleWhenChange}');
  });

  it('threads paginated archive mode into the shared footer controls', () => {
    const src = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(src).toContain('.navigationMode=${this.navigationMode}');
    expect(src).toContain('@previous-page=${() => this.handlePreviousPage()}');
    expect(src).toContain('@next-page=${() => this.handleNextPage()}');
  });

  it('forwards when to archive search requests', async () => {
    const searchMock = vi.mocked(apiClient.posts.searchCached);
    searchMock.mockResolvedValueOnce({ posts: [], resultUnits: [], pageNumber: 1, hasMore: false } as never);

    const view = Object.assign(Object.create(ViewArchive.prototype), {
      blog: 'demo-blog',
      sortValue: 'newest',
      selectedTypes: [1, 2, 3],
      selectedVariants: [],
      archiveWhen: '2026-05',
      query: '',
      searchSessionId: '',
    });

    await view.fetchArchivePageResponse(1);

    expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ when: '2026-05' }));
  });

  it('changes archive when state and forces paginated reloads when the picker emits a new value', async () => {
    const view = Object.assign(Object.create(ViewArchive.prototype), {
      archiveWhen: '',
      forcedPaginatedFromUrl: false,
      infiniteScroll: true,
      currentPage: 4,
      searchSessionId: 'sess-archive',
      hasNextPage: true,
      replaceArchiveUrlOnPageBoundary: true,
      navigationMode: 'infinite',
      loadPosts: vi.fn().mockResolvedValue(undefined),
    });

    await view.handleWhenChange({ detail: { value: '2026-05-03' } } as CustomEvent<{ value: string }>);

    expect(view.archiveWhen).toBe('2026-05-03');
    expect(view.forcedPaginatedFromUrl).toBe(true);
    expect(view.currentPage).toBe(1);
    expect(view.searchSessionId).toBe('');
    expect(view.hasNextPage).toBe(false);
    expect(view.navigationMode).toBe('paginated');
    expect(view.loadPosts).toHaveBeenCalledTimes(1);
  });
});
