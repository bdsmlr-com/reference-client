import { resolvePostRenderPolicy } from './post-render-policy';
import { resolveLink } from './link-resolver';
import type { PostPresentationModel, PresentationAction, ProcessedPost } from '../types/post';

export interface PresentationContext {
  view: string;
  role?: string;
  env?: string;
  interactionKind?: 'post' | 'reblog' | 'like' | 'comment';
}

export function toPresentationModel(post: ProcessedPost, ctx: PresentationContext): PostPresentationModel {
  const policy = resolvePostRenderPolicy({
    view: ctx.view,
    role: ctx.role,
    env: ctx.env,
  });

  const actions: PresentationAction[] = [];
  const showPermalink = policy.showPermalink !== false;
  if (showPermalink && Number.isFinite(post.id)) {
    const permalinkLink = resolveLink('post_permalink', { postId: post.id });
    actions.push({ kind: 'permalink', label: permalinkLink.icon || '🔗', contextId: 'post_permalink' });
  }

  const isInteraction = ctx.interactionKind === 'like' || ctx.interactionKind === 'comment';

  return {
    showPermalink,
    showBlogChip: policy.showBlogChip === true || isInteraction,
    compactMetadata: policy.compactMetadata === true,
    actions,
    linkContexts: {
      permalink: 'post_permalink',
      originBlog: 'post_origin_blog',
      viaBlog: 'post_via_blog',
    },
  };
}
