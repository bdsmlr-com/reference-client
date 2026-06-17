// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/components/post-actions.js';
import * as api from '../src/services/api.js';
import { clearAuthUser, setAuthUser } from '../src/state/auth-state.js';

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function makePost(id = 42, blogId = 22): any {
  return {
    id,
    blogId,
    blogName: 'hotfoxing',
    originBlogId: blogId,
    originBlogName: 'hotfoxing',
    createdAtUnix: 1718400000,
    likesCount: 5,
    reblogsCount: 6,
    commentsCount: 1,
    tags: ['legacy'],
    type: 1,
    variant: 1,
    body: 'Body text',
    content: {
      files: [],
      html: '<p>Body text</p>',
      text: 'Body text',
      title: null,
      url: null,
      thumbnail: null,
      description: null,
      quoteText: null,
      quoteSource: null,
    },
    _media: {
      type: 'text',
      text: 'Body text',
      html: '<p>Body text</p>',
    },
  };
}

describe('post-actions report modal', () => {
  afterEach(() => {
    clearAuthUser();
    document.body.innerHTML = '';
  });

  it('hides the report action on self-owned posts', async () => {
    setAuthUser({ userId: 7, blogId: 11, activeBlogId: 11, blogs: [{ id: 11, name: 'alpha' }] });

    const el = document.createElement('post-actions') as any;
    el.post = makePost(42, 11);
    el.variant = 'card';
    document.body.appendChild(el);

    await el.updateComplete;
    expect(el.shadowRoot?.textContent).not.toContain('Report');
    expect(el.shadowRoot?.querySelector('[data-action="report"]')).toBeNull();
  });

  it('opens a confirmation modal and reports the visible post id for non-owned posts', async () => {
    setAuthUser({ userId: 7, blogId: 11, activeBlogId: 11, blogs: [{ id: 11, name: 'alpha' }] });

    const calls: any[] = [];
    const reportSpy = vi.spyOn(api, 'reportPost').mockImplementation(async (req: any) => {
      calls.push(req);
      return { ok: true, action: 'report_post', postId: req.postId, actingBlogId: req.actingBlogId } as any;
    });

    try {
      const el = document.createElement('post-actions') as any;
      el.post = makePost(91, 22);
      el.variant = 'card';
      document.body.appendChild(el);
      await el.updateComplete;

      const reportButton = el.shadowRoot?.querySelector('[data-action="report"]') as HTMLButtonElement;
      expect(reportButton).toBeTruthy();
      reportButton.click();
      await flush();
      await el.updateComplete;

      expect(el.shadowRoot?.querySelector('[aria-label="Report post confirmation"]')).toBeTruthy();
      expect(el.shadowRoot?.textContent).toContain('Report post 91?');

      const confirmButton = el.shadowRoot?.querySelector('[data-confirm="report"]') as HTMLButtonElement;
      confirmButton.click();
      await flush();
      await flush();
      await el.updateComplete;

      expect(calls).toEqual([{ postId: 91, actingBlogId: 11 }]);
      expect(el.shadowRoot?.querySelector('[aria-label="Report post confirmation"]')).toBeNull();
    } finally {
      reportSpy.mockRestore();
    }
  });
});
