import { describe, expect, it } from 'vitest';
import { toPresentationModel } from '../src/services/post-presentation';
import type { ProcessedPost } from '../src/types/post';

function makePost(overrides: Partial<ProcessedPost> = {}): ProcessedPost {
  return {
    id: 686683457,
    blogName: 'NonNudeCuties',
    originBlogName: 'NonNudeCuties',
    originPostId: 686683457,
    createdAtUnix: 1713350400,
    type: 2,
    body: '',
    tags: [],
    commentsCount: 1,
    likesCount: 429,
    reblogsCount: 272,
    content: {},
    _media: { type: 'image', url: 'https://cdn.example/original.jpg' },
    ...overrides,
  } as ProcessedPost;
}

describe('toPresentationModel', () => {
  it('builds the same permalink metadata across card, lightbox, and detail contexts', () => {
    const post = makePost();
    const card = toPresentationModel(post, { surface: 'card', page: 'archive' });
    const lightbox = toPresentationModel(post, { surface: 'lightbox', page: 'archive' });
    const detail = toPresentationModel(post, { surface: 'detail', page: 'post' });

    expect(card.identity.permalink.href).toBe('/post/686683457');
    expect(lightbox.identity.permalink.href).toBe('/post/686683457');
    expect(detail.identity.permalink.href).toBe('/post/686683457');
    expect(card.identity.permalink.label).toBe(lightbox.identity.permalink.label);
    expect(lightbox.identity.permalink.title).toBe(detail.identity.permalink.title);
    expect(card.identity.summaryLine).toBe(lightbox.identity.summaryLine);
    expect(lightbox.identity.summaryLine).toBe(detail.identity.summaryLine);
  });

  it('keeps action descriptors stable across card and detail contexts', () => {
    const post = makePost();
    const card = toPresentationModel(post, { surface: 'card', page: 'feed' });
    const detail = toPresentationModel(post, { surface: 'detail', page: 'post' });

    expect(card.actions.like.visible).toBe(true);
    expect(detail.actions.like.visible).toBe(true);
    expect(card.actions.like.openMode).toBe('toggle');
    expect(detail.actions.like.openMode).toBe('toggle');
    expect(card.actions.reblog.visible).toBe(true);
    expect(detail.actions.reblog.visible).toBe(true);
    expect(card.actions.comment.openMode).toBe('modal');
    expect(detail.actions.comment.openMode).toBe('modal');
    expect(card.actions.engagementList.visible).toBe(false);
    expect(detail.actions.engagementList.visible).toBe(false);
    expect(card.actions.some((action) => action.kind === 'permalink')).toBe(true);
    expect(detail.actions.some((action) => action.kind === 'permalink')).toBe(true);
  });

  it('uses existing shared media-config preset names for each surface', () => {
    const post = makePost();
    const card = toPresentationModel(post, { surface: 'card', page: 'archive' });
    const lightbox = toPresentationModel(post, { surface: 'lightbox', page: 'archive' });
    const detail = toPresentationModel(post, { surface: 'detail', page: 'post' });
    const videoDetail = toPresentationModel(
      makePost({ _media: { type: 'video', url: 'https://cdn.example/poster.jpg', videoUrl: 'https://cdn.example/video.mp4' } }),
      { surface: 'detail', page: 'post' },
    );

    expect(card.media.preset).toBe('gallery-grid');
    expect(lightbox.media.preset).toBe('lightbox');
    expect(detail.media.preset).toBe('post-detail');
    expect(videoDetail.media.preset).toBe('poster');
  });
});
