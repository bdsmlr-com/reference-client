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
    posts: { list: vi.fn() },
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

vi.mock('../src/services/retrieval-presentation.js', () => ({
  applyRetrievalPostPolicies: vi.fn((posts: unknown[]) => posts),
}));

vi.mock('../src/config.js', () => ({
  RenderSlotConfig: class {},
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
    expect(src).toContain('buildContentNavigationState');
    expect(src).toContain("parsePositivePageParam(getUrlParam('page'))");
    expect(src).toContain("parseOpaqueParam(getUrlParam('cursor'))");
    expect(src).toContain("const hasExplicitPaginationState = explicitPage !== undefined || !!explicitCursor || !!explicitWhen;");
  });

  it('walks archive cursors to resolve explicit page state when no cursor is present', () => {
    const src = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(src).toContain('const explicitPage = parsePositivePageParam(getUrlParam(\'page\'))');
    expect(src).toContain('resolveArchivePageCursor');
    expect(src).toContain('while (resolvedPage < targetPage)');
    expect(src).toContain('this.currentPageCursor = resolvedCursor;');
  });

  it('walks archive cursors at runtime until the requested page is reached', async () => {
    const view = Object.assign(Object.create(ViewArchive.prototype), {
      pageStartCursors: new Map([[1, null]]),
      fetchArchivePageResponse: vi
        .fn()
        .mockResolvedValueOnce({ page: { nextPageToken: 'cursor-2' } })
        .mockResolvedValueOnce({ page: { nextPageToken: 'cursor-3' } }),
    });

    const resolved = await view.resolveArchivePageCursor(3);

    expect(resolved).toEqual({ resolvedPage: 3, resolvedCursor: 'cursor-3' });
    expect(view.fetchArchivePageResponse).toHaveBeenCalledTimes(2);
    expect(view.pageStartCursors.get(2)).toBe('cursor-2');
    expect(view.pageStartCursors.get(3)).toBe('cursor-3');
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

  it('forwards when to archive list requests', async () => {
    const listMock = vi.mocked(apiClient.posts.list);
    listMock.mockResolvedValueOnce({ posts: [], page: { nextPageToken: null } } as never);

    const view = Object.assign(Object.create(ViewArchive.prototype), {
      blogId: 123,
      sortValue: 'newest',
      selectedTypes: [1, 2, 3],
      selectedVariants: [],
      archiveWhen: '2026-05',
    });

    await view.fetchArchivePageResponse(null);

    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ when: '2026-05' }));
  });

  it('changes archive when state and forces paginated reloads when the picker emits a new value', async () => {
    const view = Object.assign(Object.create(ViewArchive.prototype), {
      archiveWhen: '',
      forcedPaginatedFromUrl: false,
      infiniteScroll: true,
      currentPage: 4,
      currentPageCursor: 'cursor-4',
      hasNextPage: true,
      pageStartCursors: new Map([[1, null], [2, 'cursor-2']]),
      navigationMode: 'infinite',
      loadPosts: vi.fn().mockResolvedValue(undefined),
    });

    await view.handleWhenChange({ detail: { value: '2026-05-03' } } as CustomEvent<{ value: string }>);

    expect(view.archiveWhen).toBe('2026-05-03');
    expect(view.forcedPaginatedFromUrl).toBe(true);
    expect(view.currentPage).toBe(1);
    expect(view.currentPageCursor).toBeNull();
    expect(view.hasNextPage).toBe(false);
    expect(view.pageStartCursors.get(1)).toBeNull();
    expect(view.navigationMode).toBe('paginated');
    expect(view.loadPosts).toHaveBeenCalledTimes(1);
  });
});
