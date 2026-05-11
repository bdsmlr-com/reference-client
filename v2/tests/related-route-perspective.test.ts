// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiClient } from '../src/services/client.js';
import type { Post } from '../src/types/api.js';
import '../src/pages/view-post-related.js';

const ROOT = join(process.cwd(), 'src');

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('related route perspective', () => {
  it('drops stale seed links when postId changes and an older seed request resolves late', async () => {
    const getSpy = vi.spyOn(apiClient.posts, 'get');
    const fetchStub = vi.fn().mockResolvedValue({
      json: async () => ({ posts: [], recommendations: [], similar_posts: [] }),
    });
    const requests: Array<{ id: number; deferred: ReturnType<typeof createDeferred<{ post: Partial<Post> | null }>> }> = [];
    getSpy.mockImplementation((id: number) => {
      const deferred = createDeferred<{ post: Partial<Post> | null }>();
      requests.push({ id, deferred });
      return deferred.promise as Promise<any>;
    });
    vi.stubGlobal('fetch', fetchStub);

    const el = document.createElement('view-post-related') as any;

    try {
      el.postId = '1';
      el.routePerspective = 'you';
      document.body.appendChild(el);
      await el.updateComplete;

      expect(requests.map((req) => req.id)).toEqual([1]);
      expect(el.shadowRoot?.querySelector('.perspective-nav')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('for you');

      el.postId = '2';
      await el.updateComplete;

      expect(requests.map((req) => req.id)).toEqual([1, 2]);
      expect(el.shadowRoot?.querySelector('.perspective-nav')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('for you');

      requests[0].deferred.resolve({
        post: {
          id: 1,
          originBlogName: 'old-origin',
          blogName: 'old-via',
        },
      });
      await flushMicrotasks();
      await el.updateComplete;

      expect(el.shadowRoot?.querySelector('.perspective-nav')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('for you');
      expect(el.shadowRoot?.textContent).not.toContain('for @old-origin');
      expect(el.shadowRoot?.textContent).not.toContain('for @old-via');

      requests[1].deferred.resolve({
        post: {
          id: 2,
          originBlogName: 'new-origin',
          blogName: 'new-via',
        },
      });
      await flushMicrotasks();
      await el.updateComplete;

      const labels = Array.from(el.shadowRoot?.querySelectorAll('.perspective-link') || []).map((node) =>
        (node.textContent || '').trim()
      );
      expect(labels).toEqual(['for you', 'for @new-origin', 'for @new-via']);
    } finally {
      el.remove();
      getSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('redirects the bare related route to the canonical for-you route', () => {
    const src = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(src).toContain("path: '/post/:postId/related'");
    expect(src).toContain("this.redirectLegacyRoute(`/post/${postId}/related/for/you`)");
    expect(src).toContain("path: '/post/:postId/related/for/you'");
    expect(src).toContain(".routePerspective=${'you'}");
    expect(src).toContain("title=${'More like this'}");
  });

  it('keeps the explicit related perspective route shareable and route-driven', () => {
    const src = readFileSync(join(ROOT, 'pages/view-post-related.ts'), 'utf8');

    expect(src).toContain("@property({ type: String }) routePerspective = 'you';");
    expect(src).toContain("title = 'More like this';");
    expect(src).toContain('private get currentPerspective(): string {');
    expect(src).toContain('private async loadSeedPost(id: number, loadToken: number): Promise<void> {');
    expect(src).toContain('private get perspectiveNavItems(): Array<{ href: string; label: string; active: boolean }> {');
    expect(src).toContain('this.seedLoadToken += 1;');
    expect(src).toContain('this.seedPost = null;');
    expect(src).toContain('if (loadToken !== this.seedLoadToken || id !== this.normalizedPostId) {');
    expect(src).toContain('this.seedPost?.originBlogName');
    expect(src).toContain('this.seedPost?.blogName');
    expect(src).toContain("label: `for @${normalized}`");
    expect(src).toContain('class="perspective-nav"');
    expect(src).toContain('class="perspective-link');
    expect(src).toContain('for you');
    expect(src).toContain('aria-current=${item.active ?');
    expect(src).toContain('.perspectiveBlogName=${this.perspectiveBlogName}');
    expect(src).not.toContain('.tab.active');
  });
});
