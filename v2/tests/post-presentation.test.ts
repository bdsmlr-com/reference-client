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
    expect(card.identity.isReblog).toBe(false);
    expect(card.identity.isCanonicalCard).toBe(false);
    expect(card.identity.chipBlogLabel).toContain('@');
    expect(card.identity.primaryBlogLabel).toContain('@');
    expect(card.identity.viaBlogLabel).toContain('@');
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
    expect(videoDetail.media.preset).toBe('post-detail');
  });

  it('marks reblog state in the shared identity descriptor', () => {
    const model = toPresentationModel(
      makePost({ originBlogName: 'OriginBlog', originPostId: 123 }),
      { surface: 'detail', page: 'post' },
    );

    expect(model.identity.isReblog).toBe(true);
    expect(model.identity.originBlog?.label).toContain('@');
    expect(model.identity.originBlogLabel).toContain('@');
    expect(model.identity.originPostPermalink?.href).toBe('/post/123');
    expect(model.identity.viaPostPermalink?.href).toBe('/post/686683457');
  });

  it('suppresses origin post permalink when the origin post is missing', () => {
    const model = toPresentationModel(
      makePost({ originBlogName: 'OriginBlog', originPostId: 123, originPostMissing: true }),
      { surface: 'detail', page: 'post' },
    );

    expect(model.identity.isReblog).toBe(true);
    expect(model.identity.originPostPermalink).toBeNull();
    expect(model.identity.originPostMissing).toBe(true);
  });

  it('selects the top inline identity decorations for origin and via blog identities', () => {
    const model = toPresentationModel(
      makePost({
        blogName: 'viaBlog',
        originBlogName: 'originBlog',
        originPostId: 123,
        blogIdentityDecorations: [
          {
            kind: 'role',
            token: 'moderator',
            label: 'Moderator',
            icon: '🛡️',
            priority: 20,
            visibility: ['inline_name'],
            source: 'system',
          },
        ],
        originBlogIdentityDecorations: [
          {
            kind: 'role',
            token: 'administrator',
            label: 'Administrator',
            icon: '👮',
            priority: 10,
            visibility: ['inline_name'],
            source: 'system',
          },
        ],
      }),
      { surface: 'detail', page: 'post' },
    );

    expect(model.identity.originBlogDecoration?.token).toBe('administrator');
    expect(model.identity.originBlogDecoration?.icon).toBe('👮');
    expect(model.identity.viaBlogDecoration?.token).toBe('moderator');
    expect(model.identity.viaBlogDecoration?.icon).toBe('🛡️');
  });

  it('does not copy via-blog decorations onto an undecorated origin blog', () => {
    const model = toPresentationModel(
      makePost({
        blogName: 'stokingtheflames',
        originBlogName: 'diyrubberdollmaker',
        originPostId: 838743153,
        blogIdentityDecorations: [
          {
            kind: 'role',
            token: 'contributor-qa',
            label: 'Contributor',
            icon: '🧪',
            priority: 30,
            visibility: ['inline_name'],
            source: 'config',
          },
        ],
        originBlogIdentityDecorations: [],
      }),
      { surface: 'detail', page: 'post' },
    );

    expect(model.identity.originBlogDecoration).toBeNull();
    expect(model.identity.viaBlogDecoration?.token).toBe('contributor-qa');
    expect(model.identity.viaBlogDecoration?.icon).toBe('🧪');
  });

  it('exposes canonical-card eligibility for clustered activity promotion', () => {
    const model = toPresentationModel(
      makePost({ variant: 2 }),
      { surface: 'card', page: 'activity', interactionKind: 'like', role: 'cluster' },
    );

    expect(model.identity.isCanonicalCard).toBe(true);
  });
});
