// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { extractMedia } from '../src/types/post.js';
import '../src/components/activity-grid.js';
import '../src/components/post-card.js';
import '../src/components/post-lightbox.js';

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function makePost(overrides: Record<string, unknown> = {}): any {
  const post = {
    id: 77,
    blogId: 7,
    blogName: 'alpha',
    originBlogId: 7,
    originBlogName: 'alpha',
    originPostId: 77,
    createdAtUnix: 1718400000,
    updatedAtUnix: 1718400000,
    likesCount: 0,
    reblogsCount: 0,
    commentsCount: 0,
    tags: [],
    type: 2,
    variant: 1,
    body: '',
    title: '',
    content: {
      html: '',
      text: '',
    },
    contentBlocks: [{ mediaBlock: {} }],
    mediaRepresentation: {
      kind: 'ORIGINAL',
      items: [
        { kind: 'IMAGE', original: { url: 'https://cdn.example.com/a.jpg' } },
        { kind: 'IMAGE', original: { url: 'https://cdn.example.com/b.jpg' } },
      ],
    },
  };
  const merged = { ...post, ...overrides };
  merged._media = extractMedia(merged);
  return merged;
}

describe('active media surfaces', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('post-card uses mediaRepresentation item count for gallery badges', async () => {
    const el = document.createElement('post-card') as any;
    el.post = makePost();
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.multi-image-badge')?.textContent?.trim()).toBe('1 / 2');
  });

  it('activity-item uses mediaRepresentation item count for gallery badges', async () => {
    const el = document.createElement('activity-item') as any;
    el.post = makePost();
    el.interactionType = 'post';
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.multi-image-badge')?.textContent?.trim()).toBe('1 / 2');
  });

  it('post-lightbox renders representation-derived media order instead of legacy file order', async () => {
    const post = makePost({
      mediaRepresentation: {
        kind: 'ORIGINAL',
        items: [
          { kind: 'IMAGE', original: { url: 'https://cdn.example.com/first.jpg' } },
          { kind: 'IMAGE', original: { url: 'https://cdn.example.com/second.jpg' } },
        ],
      },
    });
    post._media = extractMedia(post);

    const el = document.createElement('post-lightbox') as any;
    el.open = true;
    el.post = post;
    el.posts = [post];
    el.currentIndex = 0;
    document.body.appendChild(el);

    await flush();
    await el.updateComplete;
    await flush();
    await el.updateComplete;

    const sources = Array.from(el.shadowRoot?.querySelectorAll('media-renderer') || []).map((node: any) => node.src);
    expect(sources).toEqual([
      'https://cdn.example.com/first.jpg',
      'https://cdn.example.com/second.jpg',
    ]);
  });
});
