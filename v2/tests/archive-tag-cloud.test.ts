import { describe, expect, it, vi } from 'vitest';

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
    blogs: { getTopTags: vi.fn() },
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

vi.mock('../src/services/render-page.js', () => ({
  getPageSlotConfig: vi.fn(() => ({ loading: { cardType: '', count: 0 } })),
}));

vi.mock('../src/components/control-panel.js', () => ({}));
vi.mock('../src/components/activity-grid.js', () => ({}));
vi.mock('../src/components/load-footer.js', () => ({}));
vi.mock('../src/components/loading-spinner.js', () => ({}));
vi.mock('../src/components/skeleton-loader.js', () => ({}));
vi.mock('../src/components/error-state.js', () => ({}));
vi.mock('../src/components/blog-header.js', () => ({}));
vi.mock('../src/components/render-card.js', () => ({}));
vi.mock('../src/components/archive-tag-cloud.js', () => ({}));

const { ViewArchive } = await import('../src/pages/view-archive.js');
const { apiClient } = await import('../src/services/client.js');

describe('archive tag cloud', () => {
  it('loads top tags for the current archive blog', async () => {
    const getTopTags = vi.mocked(apiClient.blogs.getTopTags);
    getTopTags.mockResolvedValueOnce({
      blogName: 'ddlg-gent',
      tags: [{ name: 'bikini', postsCount: 12 }],
    } as never);

    const view = Object.assign(Object.create(ViewArchive.prototype), {
      blog: 'ddlg-gent',
      blogId: 123,
      archiveTagsLoading: false,
      archiveTagsError: '',
      archiveTagItems: [],
    });

    await view.loadArchiveTagCloud();

    expect(getTopTags).toHaveBeenCalledWith({ blog_name: 'ddlg-gent', page_size: 24 });
    expect(view.archiveTagItems).toEqual([{ name: 'bikini', postsCount: 12 }]);
  });

  it('replaces the archive query when a tag is selected from the cloud', async () => {
    const view = Object.assign(Object.create(ViewArchive.prototype), {
      query: 'old stuff',
      loadPosts: vi.fn().mockResolvedValue(undefined),
    });

    await view.handleArchiveTagSelect({ detail: { tag: 'best served hot' } } as CustomEvent<{ tag: string }>);

    expect(view.query).toBe('tag:\"best served hot\"');
    expect(view.loadPosts).toHaveBeenCalledTimes(1);
  });
});
