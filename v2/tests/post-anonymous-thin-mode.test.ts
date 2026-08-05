// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../src/services/client.js';
import '../src/components/post-actions.js';
import '../src/components/post-engagement.js';

const COMPONENTS_ROOT = join(process.cwd(), 'src/components');

function createPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    blogId: 10,
    blogName: 'demo-blog',
    createdAtUnix: 1_700_000_000,
    likesCount: 12,
    reblogsCount: 8,
    commentsCount: 4,
    _media: {
      representationKind: 'IMAGE',
      items: [],
    },
    ...overrides,
  } as any;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('anonymous thin post mode', () => {
  it('renders CTA-only detail actions without aggregate counts for anonymous and unknown auth', async () => {
    for (const authMode of ['anonymous', 'unknown'] as const) {
      const el = document.createElement('post-actions') as any;
      el.variant = 'detail';
      el.post = createPost();
      el.authMode = authMode;

      document.body.appendChild(el);

      try {
        await el.updateComplete;

        const text = el.shadowRoot?.textContent?.replace(/\s+/g, ' ').trim() || '';
        expect(text).toContain('Log in to like');
        expect(text).toContain('Log in to reblog');
        expect(text).toContain('Log in to comment');
        expect(text).not.toContain('12');
        expect(text).not.toContain('8');
        expect(text).not.toContain('4');
      } finally {
        el.remove();
      }
    }
  });

  it('does not fetch engagement detail in anonymous mode', async () => {
    const likesSpy = vi.spyOn(apiClient.engagement, 'getLikes').mockResolvedValue({ likes: [] } as any);
    const reblogsSpy = vi.spyOn(apiClient.engagement, 'getReblogs').mockResolvedValue({ reblogs: [] } as any);
    const commentsSpy = vi.spyOn(apiClient.engagement, 'getComments').mockResolvedValue({ comments: [] } as any);

    const el = document.createElement('post-engagement') as any;
    el.post = createPost();
    el.authMode = 'anonymous';

    document.body.appendChild(el);

    try {
      await el.updateComplete;

      const actionStrip = el.shadowRoot?.querySelector('post-actions') as any;
      expect(actionStrip).toBeTruthy();
      await actionStrip.updateComplete;

      const buttons = Array.from(actionStrip.shadowRoot?.querySelectorAll('button') || []);
      buttons.forEach((button) => button.click());
      await flush();
      await el.updateComplete;

      expect(likesSpy).not.toHaveBeenCalled();
      expect(reblogsSpy).not.toHaveBeenCalled();
      expect(commentsSpy).not.toHaveBeenCalled();
    } finally {
      el.remove();
      likesSpy.mockRestore();
      reblogsSpy.mockRestore();
      commentsSpy.mockRestore();
    }
  });

  it('does not activate engagement tabs before auth resolves', async () => {
    const likesSpy = vi.spyOn(apiClient.engagement, 'getLikes').mockResolvedValue({ likes: [] } as any);
    const reblogsSpy = vi.spyOn(apiClient.engagement, 'getReblogs').mockResolvedValue({ reblogs: [] } as any);
    const commentsSpy = vi.spyOn(apiClient.engagement, 'getComments').mockResolvedValue({ comments: [] } as any);

    for (const authMode of ['anonymous', 'unknown'] as const) {
      const el = document.createElement('post-engagement') as any;
      el.post = createPost();
      el.authMode = authMode;

      document.body.appendChild(el);

      try {
        await el.updateComplete;

        const actionStrip = el.shadowRoot?.querySelector('post-actions') as any;
        expect(actionStrip).toBeTruthy();
        await actionStrip.updateComplete;

        expect(el.activeTab).toBeNull();
        actionStrip.dispatchEvent(new CustomEvent('engagement-open-tab', {
          detail: { tab: 'likes' },
          bubbles: true,
          composed: true,
        }));
        await flush();
        await el.updateComplete;

        expect(el.activeTab).toBeNull();
        expect(likesSpy).not.toHaveBeenCalled();
        expect(reblogsSpy).not.toHaveBeenCalled();
        expect(commentsSpy).not.toHaveBeenCalled();
      } finally {
        el.remove();
      }
    }

    likesSpy.mockRestore();
    reblogsSpy.mockRestore();
    commentsSpy.mockRestore();
  });

  it('keeps the comments pane open when the fetched comments exceed the embedded count', async () => {
    const commentsSpy = vi.spyOn(apiClient.engagement, 'getComments').mockResolvedValue({
      comments: [
        {
          blogName: 'demo-blog',
          blogId: 10,
          createdAtUnix: 1_700_000_100,
          body: 'first comment',
        },
        {
          blogName: 'other-blog',
          blogId: 11,
          createdAtUnix: 1_700_000_200,
          body: 'second comment',
        },
      ],
    } as any);

    const el = document.createElement('post-engagement') as any;
    el.post = createPost({ commentsCount: 1 });
    el.authMode = 'authenticated';

    document.body.appendChild(el);

    try {
      await el.updateComplete;

      const actionStrip = el.shadowRoot?.querySelector('post-actions') as any;
      expect(actionStrip).toBeTruthy();
      actionStrip.dispatchEvent(new CustomEvent('engagement-open-tab', {
        detail: { tab: 'comments' },
        bubbles: true,
        composed: true,
      }));
      await flush();
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      expect(commentsSpy).toHaveBeenCalledWith(1);
      expect(el.activeTab).toBe('comments');
      expect(el.shadowRoot?.textContent).toContain('first comment');
      expect(el.shadowRoot?.textContent).toContain('second comment');
    } finally {
      el.remove();
      commentsSpy.mockRestore();
    }
  });

  it('threads anonymous auth mode into engagement and seeds recommendations from the original post', () => {
    const detailSrc = readFileSync(join(COMPONENTS_ROOT, 'post-detail-content.ts'), 'utf8');

    expect(detailSrc).toContain("@property({ type: String }) authMode: 'unknown' | 'authenticated' | 'anonymous' = 'authenticated';");
    expect(detailSrc).toContain('<post-engagement .post=${p} .authMode=${this.authMode}');
    expect(detailSrc).toContain('const recommendationSeedPostId = presentation.identity.isReblog && p.originPostId');
    expect(detailSrc).toContain('? p.originPostId');
    expect(detailSrc).toContain(': p.id;');
    expect(detailSrc).toContain('<post-recommendations .postId=${recommendationSeedPostId}');
  });
});
