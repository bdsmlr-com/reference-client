import { resolveLink } from './link-resolver';
import {
  POST_TYPE_ICONS,
  POST_TYPE_LABELS,
  type MediaPresentationDescriptor,
  type PostPresentationModel,
  type PresentationAction,
  type PresentationContext,
  type ProcessedPost,
} from '../types/post';
import type { IdentityDecoration } from '../types/api.js';

type NormalizedPresentationContext = Required<Pick<PresentationContext, 'surface' | 'page'>> & PresentationContext;

function normalizePresentationContext(ctx: PresentationContext): NormalizedPresentationContext {
  const fallbackPage = ctx.view === 'archive' || ctx.view === 'search' || ctx.view === 'activity' || ctx.view === 'post' || ctx.view === 'feed' || ctx.view === 'social'
    ? ctx.view
    : 'feed';
  const page = ctx.page || fallbackPage;
  const surface = ctx.surface || (page === 'post' ? 'detail' : 'card');

  return {
    ...ctx,
    surface,
    page,
  };
}

function buildActionSet(post: ProcessedPost, ctx: NormalizedPresentationContext, permalink: ReturnType<typeof resolveLink>) {
  const like: PresentationAction = {
    kind: 'like',
    label: 'Like',
    contextId: 'post_like',
    visible: true,
    openMode: 'toggle',
    chipMode: 'count',
    count: post.likesCount ?? post.notesCount ?? 0,
    icon: '♥',
  };

  const reblog: PresentationAction = {
    kind: 'reblog',
    label: 'Reblog',
    contextId: 'post_reblog',
    visible: true,
    openMode: 'toggle',
    chipMode: 'count',
    count: post.reblogsCount ?? 0,
    icon: '♻️',
  };

  const comment: PresentationAction = {
    kind: 'comment',
    label: 'Comment',
    contextId: 'post_comment',
    visible: true,
    openMode: 'modal',
    chipMode: 'count',
    count: post.commentsCount ?? 0,
    icon: '💬',
  };

  const engagementList: PresentationAction = {
    kind: 'engagementList',
    label: 'Engagement',
    contextId: 'post_engagement_list',
    visible: ctx.page === 'activity' || ctx.surface === 'timeline',
    openMode: 'panel',
    chipMode: 'none',
    icon: '☰',
  };

  const permalinkAction: PresentationAction = {
    kind: 'permalink',
    label: permalink.label || 'Permalink',
    contextId: 'post_permalink',
    visible: true,
    openMode: 'navigate',
    chipMode: 'none',
    icon: permalink.icon || '↗',
  };

  const values = [permalinkAction, like, reblog, comment, engagementList];

  return {
    permalink: permalinkAction,
    like,
    reblog,
    comment,
    engagementList,
    some(predicate: (action: PresentationAction) => boolean) {
      return values.some(predicate);
    },
    values() {
      return [...values];
    },
  };
}

function pickInlineDecoration(decorations?: IdentityDecoration[] | null): IdentityDecoration | null {
  const eligible = (decorations || []).filter((decoration) => {
    if (!decoration) return false;
    const visibility = decoration.visibility || [];
    return visibility.length === 0 || visibility.includes('inline_name');
  });
  if (!eligible.length) {
    return null;
  }
  eligible.sort((left, right) => {
    const priorityDelta = (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return (left.token || '').localeCompare(right.token || '');
  });
  return eligible[0] || null;
}

function buildIdentity(post: ProcessedPost) {
  const permalink = resolveLink('post_permalink', { postId: post.id });
  const isReblog = Boolean(post.originPostId && post.originPostId !== post.id);
  const isCanonicalCard = post.variant === 1 || post.variant === 2;
  const originBlogName = post.originBlogName || post.blogName || '';
  const blogLabel = originBlogName || `Post ${post.id}`;
  const originBlog = originBlogName
    ? resolveLink('post_origin_blog', { blog: originBlogName })
    : null;
  const viaBlogName = post.blogName && post.blogName !== originBlogName ? post.blogName : '';
  const viaBlog = viaBlogName
    ? resolveLink('post_via_blog', { blog: viaBlogName })
    : null;
  const originBlogLabel = originBlog?.label || (originBlogName ? `@${originBlogName}` : '');
  const viaFallbackName = viaBlogName || originBlogName || '';
  const viaBlogLabel = viaBlog?.label || (viaFallbackName ? `@${viaFallbackName}` : '');
  const originBlogDecoration = pickInlineDecoration(post.originBlogIdentityDecorations);
  const viaBlogDecoration = pickInlineDecoration(post.blogIdentityDecorations);
  const originPostMissing = Boolean(isReblog && post.originPostMissing);
  const originPostPermalink = isReblog && post.originPostId && !originPostMissing
    ? resolveLink('post_permalink', { postId: post.originPostId })
    : null;
  const viaPostPermalink = isReblog ? permalink : null;
  const chipBlogLabel = isReblog
    ? originBlogLabel
    : viaBlogLabel;
  const primaryBlogLabel = isReblog ? originBlogLabel : viaBlogLabel;

  return {
    isReblog,
    isCanonicalCard,
    allowSelfSameDayLikeSuppression: !isReblog && post.variant !== 2,
    postTypeIcon: POST_TYPE_ICONS[post.type] || '❓',
    permalink,
    originPostPermalink,
    originPostMissing,
    viaPostPermalink,
    originBlog,
    viaBlog,
    originBlogDecoration,
    viaBlogDecoration,
    originBlogLabel,
    viaBlogLabel,
    primaryBlogLabel,
    chipBlogLabel,
    summaryLine: `${blogLabel} · ${POST_TYPE_LABELS[post.type]}`,
  };
}

function buildLayout(ctx: NormalizedPresentationContext) {
  return {
    showBlogChip: ctx.surface !== 'lightbox',
    compactMetadata: ctx.surface === 'card' || ctx.page === 'feed',
    showTags: ctx.surface !== 'lightbox',
    showRecommendations: ctx.page === 'post' || ctx.page === 'activity',
  };
}

function buildMediaDescriptor(post: ProcessedPost, ctx: NormalizedPresentationContext): MediaPresentationDescriptor {
  const media = post._media || { type: 'none' };

  return {
    ...media,
    preset: ctx.surface === 'lightbox' || ctx.surface === 'detail'
      ? 'detail'
      : ctx.page === 'feed'
        ? 'masonry'
        : 'card',
  };
}

export function toPresentationModel(post: ProcessedPost, ctx: PresentationContext): PostPresentationModel {
  const normalizedContext = normalizePresentationContext(ctx);
  const identity = buildIdentity(post);
  const layout = buildLayout(normalizedContext);
  const actions = buildActionSet(post, normalizedContext, identity.permalink);
  const media = buildMediaDescriptor(post, normalizedContext);

  return {
    identity,
    actions,
    layout,
    media,
    showPermalink: true,
    showBlogChip: layout.showBlogChip,
    compactMetadata: layout.compactMetadata,
    linkContexts: {
      permalink: 'post_permalink',
      originBlog: 'post_origin_blog',
      viaBlog: 'post_via_blog',
    },
  };
}
