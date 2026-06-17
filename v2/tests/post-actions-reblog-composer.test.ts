// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../src/components/post-actions.js';
import { apiClient } from '../src/services/client.js';
import { clearAuthUser, setAuthUser } from '../src/state/auth-state.js';

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function makePost(id = 42): any {
  return {
    id,
    blogId: 22,
    blogName: 'hotfoxing',
    originBlogId: 22,
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

describe('post-actions reblog composer', () => {
  afterEach(() => {
    clearAuthUser();
    document.body.innerHTML = '';
  });

  it('opens one shared composer with the note field visible and focused by default', async () => {
    setAuthUser({ userId: 7, blogId: 11, activeBlogId: 11, blogs: [{ id: 11, name: 'alpha' }] });

    const el = document.createElement('post-actions') as any;
    el.post = makePost();
    el.variant = 'card';
    document.body.appendChild(el);

    await el.updateComplete;
    const trigger = el.shadowRoot?.querySelector('.icon-btn') as HTMLButtonElement;
    trigger.click();
    await flush();
    await el.updateComplete;

    const textarea = el.shadowRoot?.querySelector('.reblog-note') as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    expect(textarea?.value).toBe('');
    expect(el.shadowRoot?.querySelector('[aria-label="Reblog composer"]')).toBeTruthy();
    expect(el.shadowRoot?.textContent).toContain('Tags (optional)');
    expect(el.shadowRoot?.querySelector('.reblog-note')).toBe(textarea);
  });

  it('commits tags on comma, flushes trailing input on submit, and sends live reblogs through the shared engagement API', async () => {
    setAuthUser({ userId: 7, blogId: 11, activeBlogId: 11, blogs: [{ id: 11, name: 'alpha' }] });

    const originalBatchLikes = apiClient.engagement.batchGetLikeStates;
    const originalBatchReblogs = apiClient.engagement.batchGetReblogStates;
    const originalReblog = apiClient.engagement.reblogPost;
    const calls: any[] = [];
    apiClient.engagement.batchGetLikeStates = async () => ({ states: [] } as any);
    apiClient.engagement.batchGetReblogStates = async () => ({ states: [] } as any);
    apiClient.engagement.reblogPost = async (req: any) => {
      calls.push(req);
      return { ok: true, action: 'reblog', postId: req.postId, actingBlogId: req.actingBlogId, createdReblogPostId: 99 } as any;
    };

    try {
      const el = document.createElement('post-actions') as any;
      el.post = makePost(77);
      el.variant = 'card';
      document.body.appendChild(el);
      await el.updateComplete;


      (el.shadowRoot?.querySelector('.icon-btn') as HTMLButtonElement).click();
      await flush();
      await el.updateComplete;

      const note = el.shadowRoot?.querySelector('.reblog-note') as HTMLTextAreaElement;
      note.value = 'quoted hello';
      note.dispatchEvent(new Event('input', { bubbles: true }));

      const tagInput = el.shadowRoot?.querySelector('.tag-input') as HTMLInputElement;
      tagInput.value = '#Alpha';
      tagInput.dispatchEvent(new Event('input', { bubbles: true }));
      tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: ',', bubbles: true }));
      await el.updateComplete;
      expect(Array.from(el.shadowRoot?.querySelectorAll('.tag-chip') || []).map((node) => node.textContent?.replace('×', '').trim())).toEqual(['#Alpha']);

      tagInput.value = 'beta';
      tagInput.dispatchEvent(new Event('input', { bubbles: true }));
      const liveButton = el.shadowRoot?.querySelector('[data-mode="live"]') as HTMLButtonElement;
      liveButton.click();
      await flush();
      await flush();
      await el.updateComplete;

      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual({
        postId: 77,
        actingBlogId: 11,
        comment: 'quoted hello',
        tags: ['Alpha', 'beta'],
        mode: 'live',
      });
      expect(el.shadowRoot?.querySelector('.reblog-note')).toBeNull();
      expect((el.shadowRoot?.querySelector('.icon-btn') as HTMLButtonElement).className).toContain('reblog-active');
    } finally {
      apiClient.engagement.batchGetLikeStates = originalBatchLikes;
      apiClient.engagement.batchGetReblogStates = originalBatchReblogs;
      apiClient.engagement.reblogPost = originalReblog;
    }
  });

  it('submits queued reblogs without lighting up the actor reblog state', async () => {
    setAuthUser({ userId: 7, blogId: 11, activeBlogId: 11, blogs: [{ id: 11, name: 'alpha' }] });

    const originalReblog = apiClient.engagement.reblogPost;
    const calls: any[] = [];
    apiClient.engagement.reblogPost = async (req: any) => {
      calls.push(req);
      return { ok: true, action: 'queue_reblog', postId: req.postId, actingBlogId: req.actingBlogId, createdReblogPostId: 77 } as any;
    };

    try {
      const el = document.createElement('post-actions') as any;
      el.post = makePost(91);
      el.variant = 'card';
      document.body.appendChild(el);
      await el.updateComplete;


      (el.shadowRoot?.querySelector('.icon-btn') as HTMLButtonElement).click();
      await flush();
      await el.updateComplete;

      const tagInput = el.shadowRoot?.querySelector('.tag-input') as HTMLInputElement;
      tagInput.value = 'queue-tag';
      tagInput.dispatchEvent(new Event('input', { bubbles: true }));

      const queueButton = el.shadowRoot?.querySelector('[data-mode="queue"]') as HTMLButtonElement;
      queueButton.click();
      await flush();
      await flush();
      await el.updateComplete;

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ postId: 91, actingBlogId: 11, mode: 'queue', tags: ['queue-tag'] });
      expect(el.shadowRoot?.querySelector('.reblog-note')).toBeNull();
      expect((el.shadowRoot?.querySelector('.icon-btn') as HTMLButtonElement).className).not.toContain('reblog-active');
    } finally {
      apiClient.engagement.reblogPost = originalReblog;
    }
  });
});
