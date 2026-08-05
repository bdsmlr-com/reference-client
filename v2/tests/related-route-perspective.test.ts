// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../src/services/client.js';
import { clearAuthUser, setAuthUser } from '../src/state/auth-state.js';
import '../src/pages/view-post-related.js';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderRelatedPage(input: { routePerspective: string; post: Record<string, unknown> }) {
  vi.spyOn(apiClient.posts, 'get').mockResolvedValue({ post: input.post } as any);
  vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
  vi.spyOn(apiClient.posts, 'relatedLegacy').mockResolvedValue({ posts: [] } as any);

  const element = document.createElement('view-post-related') as any;
  element.postId = '50';
  element.routePerspective = input.routePerspective;
  document.body.append(element);
  await element.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await element.updateComplete;
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
  clearAuthUser();
  vi.restoreAllMocks();
});

describe('related route perspective', () => {
  it('drops stale seed tabs when postId changes and an older seed request resolves late', async () => {
    const getSpy = vi.spyOn(apiClient.posts, 'get');
    vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    vi.spyOn(apiClient.posts, 'relatedLegacy').mockResolvedValue({ posts: [] } as any);
    const requests: Array<{ id: number; deferred: ReturnType<typeof createDeferred<{ post: Record<string, unknown> | null }>> }> = [];
    getSpy.mockImplementation((id: number) => {
      const deferred = createDeferred<{ post: Record<string, unknown> | null }>();
      requests.push({ id, deferred });
      return deferred.promise as Promise<any>;
    });

    const element = document.createElement('view-post-related') as any;
    element.postId = '1';
    element.routePerspective = 'you';
    document.body.append(element);
    await element.updateComplete;

    expect(requests.map((request) => request.id)).toEqual([1]);
    expect(element.shadowRoot?.querySelectorAll('[role="tab"]')).toHaveLength(0);

    element.postId = '2';
    await element.updateComplete;
    expect(requests.map((request) => request.id)).toEqual([1, 2]);

    requests[0].deferred.resolve({
      post: { id: 1, originBlogName: 'old-origin', blogName: 'old-via' },
    });
    await flushMicrotasks();
    await element.updateComplete;
    expect(element.shadowRoot?.textContent).not.toContain('old-origin');

    requests[1].deferred.resolve({
      post: { id: 2, originBlogName: 'new-origin', blogName: 'new-via' },
    });
    await flushMicrotasks();
    await element.updateComplete;
    expect(Array.from(element.shadowRoot?.querySelectorAll('[role="tab"]') || []).map((tab) => tab.textContent?.trim()))
      .toEqual(['Original blog (@new-origin)']);
  });

  it('renders canonical accessible perspective tabs in viewer, original, reblogger order', async () => {
    setAuthUser({
      userId: 1,
      blogId: 30,
      activeBlogId: 30,
      activeBlogName: 'viewer-blog',
      blogs: [{ id: 30, name: 'viewer-blog' }],
    });
    const element = await renderRelatedPage({
      routePerspective: 'you',
      post: {
        id: 50,
        originPostId: 40,
        originBlogId: 10,
        originBlogName: 'original-blog',
        blogId: 20,
        blogName: 'reblogger-blog',
      },
    });

    const tablist = element.shadowRoot?.querySelector('[role="tablist"]');
    const tabs = Array.from(element.shadowRoot?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') || []);
    const panel = element.shadowRoot?.querySelector<HTMLElement>('[role="tabpanel"]');

    expect(tablist).not.toBeNull();
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Your perspective (@viewer-blog)',
      'Original blog (@original-blog)',
      'Reblogger (@reblogger-blog)',
    ]);
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([
      '/post/50/related/for/you',
      '/post/50/related/for/original-blog',
      '/post/50/related/for/reblogger-blog',
    ]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs.slice(1).map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false']);
    expect(panel?.id).toBe(tabs[0].getAttribute('aria-controls'));
    expect(element.shadowRoot?.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    expect(element.shadowRoot?.textContent).toContain('Perspectives for similar posts from @original-blog');
    expect((element.shadowRoot?.querySelector('post-recommendations') as any)?.postId).toBe(40);
  });

  it('deduplicates same-blog perspectives and keeps the active tab as an anchor', async () => {
    setAuthUser({
      userId: 1,
      blogId: 10,
      activeBlogId: 10,
      activeBlogName: 'original-blog',
      blogs: [{ id: 10, name: 'original-blog' }],
    });
    const element = await renderRelatedPage({
      routePerspective: 'original-blog',
      post: {
        id: 50,
        originPostId: 40,
        originBlogId: 10,
        originBlogName: 'original-blog',
        blogId: 20,
        blogName: 'reblogger-blog',
      },
    });

    const tabs = Array.from(element.shadowRoot?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') || []);
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Original blog (@original-blog)',
      'Reblogger (@reblogger-blog)',
    ]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(element.shadowRoot?.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby'))
      .toBe(tabs[0].id);
  });

  it('uses the original perspective as the active anonymous canonical route for an original post', async () => {
    const element = await renderRelatedPage({
      routePerspective: 'you',
      post: {
        id: 50,
        blogId: 10,
        blogName: 'original-blog',
      },
    });

    const tabs = Array.from(element.shadowRoot?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') || []);
    const activeTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');

    expect(activeTab?.textContent?.trim()).toBe('Original blog (@original-blog)');
    expect(activeTab?.getAttribute('tabindex')).toBe('0');
    expect(apiClient.posts.related).toHaveBeenCalledWith(expect.objectContaining({
      seed_post_id: 50,
      perspective_role: 'original',
      perspective_blog_id: 10,
      perspective_blog_name: 'original-blog',
    }), expect.any(Object));
  });

  it('uses the reblogger perspective as the active anonymous canonical route and keeps it keyboard-reachable', async () => {
    const element = await renderRelatedPage({
      routePerspective: 'you',
      post: {
        id: 50,
        originPostId: 40,
        originBlogId: 10,
        originBlogName: 'original-blog',
        blogId: 20,
        blogName: 'reblogger-blog',
      },
    });

    const related = vi.mocked(apiClient.posts.related);
    const tabs = Array.from(element.shadowRoot?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') || []);
    const activeTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');

    expect(activeTab?.textContent?.trim()).toBe('Reblogger (@reblogger-blog)');
    expect(activeTab?.getAttribute('tabindex')).toBe('0');
    expect(apiClient.posts.related).toHaveBeenCalledWith(expect.objectContaining({
      seed_post_id: 40,
      perspective_role: 'reblogger',
      perspective_blog_id: 20,
      perspective_blog_name: 'reblogger-blog',
      displayedReblogPostId: 50,
    }), expect.any(Object));

    related.mockClear();
    activeTab?.focus();
    expect(element.shadowRoot?.activeElement).toBe(activeTab);
    activeTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(element.shadowRoot?.activeElement).toBe(tabs[0]);
    expect(related).not.toHaveBeenCalled();
  });

  it('keeps an unresolved authenticated viewer unavailable while making the first alternative tab keyboard-reachable', async () => {
    setAuthUser({ userId: 1, blogId: null, blogs: [] });
    const element = await renderRelatedPage({
      routePerspective: 'you',
      post: {
        id: 50,
        originPostId: 40,
        originBlogId: 10,
        originBlogName: 'original-blog',
        blogId: 20,
        blogName: 'reblogger-blog',
      },
    });

    const related = vi.mocked(apiClient.posts.related);
    const tabs = Array.from(element.shadowRoot?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') || []);

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false']);
    expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1']);
    expect(related).not.toHaveBeenCalled();

    tabs[0].focus();
    expect(element.shadowRoot?.activeElement).toBe(tabs[0]);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(element.shadowRoot?.activeElement).toBe(tabs[1]);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false']);
    expect(related).not.toHaveBeenCalled();
  });

  it('moves focus with arrows without loading or selecting, then activates with Enter and Space', async () => {
    setAuthUser({
      userId: 1,
      blogId: 30,
      activeBlogId: 30,
      activeBlogName: 'viewer-blog',
      blogs: [{ id: 30, name: 'viewer-blog' }],
    });
    const element = await renderRelatedPage({
      routePerspective: 'you',
      post: {
        id: 50,
        originPostId: 40,
        originBlogId: 10,
        originBlogName: 'original-blog',
        blogId: 20,
        blogName: 'reblogger-blog',
      },
    });
    const related = vi.mocked(apiClient.posts.related);
    related.mockClear();
    const tabs = Array.from(element.shadowRoot?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') || []);
    const activate = vi.fn((event: Event) => event.preventDefault());
    tabs[2].addEventListener('click', activate);

    tabs[0].focus();
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(element.shadowRoot?.activeElement).toBe(tabs[2]);
    expect(related).not.toHaveBeenCalled();
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(element.shadowRoot?.activeElement).toBe(tabs[0]);
    expect(related).not.toHaveBeenCalled();

    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(activate).toHaveBeenCalledTimes(2);
    expect(related).not.toHaveBeenCalled();
  });
});
