// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '../src/services/client.js';
import { FEATURE_FLAGS } from '../src/config.js';
import { setAuthUser, updateActiveBlog } from '../src/state/auth-state.js';
import '../src/components/post-actions.js';
import '../src/components/post-engagement.js';
import '../src/components/post-detail-content.js';

function createPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    type: 2,
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

  it('uses the reblogger perspective with the original post as the anonymous recommendation seed', async () => {
    setAuthUser(null);
    const originalFeatureFlag = FEATURE_FLAGS.more_like_this_on_post;
    FEATURE_FLAGS.more_like_this_on_post = true;
    const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    const element = document.createElement('post-detail-content') as any;
    element.authMode = 'anonymous';
    element.post = createPost({
      id: 22,
      blogId: 20,
      blogName: 'reblogger',
      originPostId: 11,
      originBlogId: 10,
      originBlogName: 'origin',
    });
    document.body.append(element);

    try {
      await element.updateComplete;
      const recommendations = element.shadowRoot?.querySelector('post-recommendations') as any;
      expect(recommendations.postId).toBe(11);
      expect(recommendations.perspective).toMatchObject({ role: 'reblogger', blogName: 'reblogger', blogId: 20 });
    } finally {
      element.remove();
      FEATURE_FLAGS.more_like_this_on_post = originalFeatureFlag;
      related.mockRestore();
    }
  });

  it('uses the active viewer blog for authenticated recommendation requests', async () => {
    setAuthUser({ userId: 1, blogId: 30, activeBlogId: 31, activeBlogName: 'active-viewer' });
    const originalFeatureFlag = FEATURE_FLAGS.more_like_this_on_post;
    FEATURE_FLAGS.more_like_this_on_post = true;
    const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    const element = document.createElement('post-detail-content') as any;
    element.authMode = 'authenticated';
    element.post = createPost({ id: 22, blogId: 20, blogName: 'author' });
    document.body.append(element);

    try {
      await element.updateComplete;
      const recommendations = element.shadowRoot?.querySelector('post-recommendations') as any;
      expect(recommendations.perspective).toMatchObject({ role: 'viewer', blogName: 'active-viewer', blogId: 31 });
    } finally {
      element.remove();
      setAuthUser(null);
      FEATURE_FLAGS.more_like_this_on_post = originalFeatureFlag;
      related.mockRestore();
    }
  });

  it('resolves an unnamed active viewer ID through the selected blog before requesting recommendations', async () => {
    setAuthUser({
      userId: 1,
      blogId: 30,
      blogName: 'primary-blog',
      activeBlogId: 31,
      blogs: [
        { id: 30, name: 'primary-blog' },
        { id: 31, name: 'selected-blog' },
      ],
    });
    const originalFeatureFlag = FEATURE_FLAGS.more_like_this_on_post;
    FEATURE_FLAGS.more_like_this_on_post = true;
    const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    const element = document.createElement('post-detail-content') as any;
    element.authMode = 'authenticated';
    element.post = createPost({ id: 22, blogId: 20, blogName: 'author' });
    document.body.append(element);

    try {
      await element.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(related).toHaveBeenCalledWith(expect.objectContaining({
        perspective_role: 'viewer',
        perspective_blog_id: 31,
        perspective_blog_name: 'selected-blog',
      }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    } finally {
      element.remove();
      setAuthUser(null);
      FEATURE_FLAGS.more_like_this_on_post = originalFeatureFlag;
      related.mockRestore();
    }
  });

  it('refreshes recommendations when the authenticated active blog changes', async () => {
    setAuthUser({
      userId: 1,
      blogId: 30,
      activeBlogId: 30,
      blogs: [
        { id: 30, name: 'primary-blog' },
        { id: 31, name: 'selected-blog' },
      ],
    });
    const originalFeatureFlag = FEATURE_FLAGS.more_like_this_on_post;
    FEATURE_FLAGS.more_like_this_on_post = true;
    const related = vi.spyOn(apiClient.posts, 'related').mockResolvedValue({ posts: [] } as any);
    const element = document.createElement('post-detail-content') as any;
    element.authMode = 'authenticated';
    element.post = createPost({ id: 22, blogId: 20, blogName: 'author' });
    document.body.append(element);

    try {
      await element.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
      updateActiveBlog(31, 'selected-blog');
      await element.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(related).toHaveBeenCalledTimes(2);
      expect(related).toHaveBeenLastCalledWith(expect.objectContaining({
        perspective_role: 'viewer',
        perspective_blog_id: 31,
        perspective_blog_name: 'selected-blog',
      }), expect.any(Object));
    } finally {
      element.remove();
      setAuthUser(null);
      FEATURE_FLAGS.more_like_this_on_post = originalFeatureFlag;
      related.mockRestore();
    }
  });
});
