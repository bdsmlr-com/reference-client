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
  it('renders CTA-only detail actions without aggregate counts', async () => {
    const el = document.createElement('post-actions') as any;
    el.variant = 'detail';
    el.post = createPost();
    el.authMode = 'anonymous';

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

  it('threads anonymous auth mode from post detail into engagement while keeping recommendations mounted', () => {
    const detailSrc = readFileSync(join(COMPONENTS_ROOT, 'post-detail-content.ts'), 'utf8');

    expect(detailSrc).toContain("@property({ type: String }) authMode: 'unknown' | 'authenticated' | 'anonymous' = 'authenticated';");
    expect(detailSrc).toContain('<post-engagement .post=${p} .authMode=${this.authMode}');
    expect(detailSrc).toContain('<post-recommendations .postId=${p.id}');
  });
});
