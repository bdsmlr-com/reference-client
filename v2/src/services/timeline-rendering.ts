import { format } from 'date-fns';
import type { ProcessedPost } from '../types/post.js';
import type { TimelineItem } from '../types/api.js';
import type { ActivityKind } from './profile.js';
import { toPresentationModel } from './post-presentation.js';

export type BucketInteraction = {
  post: ProcessedPost;
  type: 'like' | 'comment';
};

export type ActivityRunBucket = {
  key: string;
  kind: 'like' | 'comment';
  actor: string;
  actorKey: string;
  likeCount: number;
  commentCount: number;
  oldestInteractionUnix: number;
  latestInteractionUnix: number;
  interactions: BucketInteraction[];
  interactionIndex: Map<number, number>;
};

export type RenderableTimelineItem =
  | { type: 'post'; post: ProcessedPost }
  | { type: 'activity-bucket'; bucket: ActivityRunBucket };

type BuildRenderableTimelineItemsArgs = {
  items: TimelineItem[];
  activityKinds: ActivityKind[];
  showActorInCluster: boolean;
  presentationPage: 'feed' | 'activity';
  viewedBlogName: string;
};

function normalizeBlogName(name: string | undefined | null): string {
  return (name || '').trim().toLowerCase();
}

export function getTimelineInteractionUnix(post: ProcessedPost): number {
  return post._activityCreatedAtUnix || post.updatedAtUnix || post.createdAtUnix || 0;
}

function getDateKey(post: ProcessedPost): string {
  const ts = getTimelineInteractionUnix(post);
  if (!ts) return 'unknown-date';
  return format(new Date(ts * 1000), 'yyyy-MM-dd');
}

function inferTimelineItemKind(item: TimelineItem, presentationPage: 'feed' | 'activity'): ActivityKind {
  if (item.type === 1 && item.post) {
    const p = item.post as ProcessedPost;
    if (p._activityKindOverride) return p._activityKindOverride;
    const presentation = toPresentationModel(p, { surface: 'timeline', page: presentationPage });
    return presentation.identity.isReblog ? 'reblog' : 'post';
  }
  if (item.type === 2 && item.cluster) {
    const label = (item.cluster.label || '').toLowerCase();
    if (label.includes('comment')) return 'comment';
    if (label.includes('reblog')) return 'reblog';
    return 'like';
  }
  return 'post';
}

function shouldSuppressSelfSameDayLike(
  post: ProcessedPost,
  kind: ActivityKind,
  presentationPage: 'feed' | 'activity',
  showActorInCluster: boolean,
  viewedBlogName: string,
): boolean {
  if (kind !== 'like' || showActorInCluster) return false;
  const presentation = toPresentationModel(post, { surface: 'timeline', page: presentationPage, interactionKind: kind });
  if (!presentation.identity.allowSelfSameDayLikeSuppression) return false;

  const viewedBlog = normalizeBlogName(viewedBlogName);
  if (!viewedBlog) return false;

  const ownerBlog = normalizeBlogName(post.blogName);
  if (!ownerBlog || ownerBlog !== viewedBlog) return false;

  const postDateKey = post.createdAtUnix ? format(new Date(post.createdAtUnix * 1000), 'yyyy-MM-dd') : '';
  const interactionDateKey = getDateKey(post);
  return Boolean(postDateKey) && postDateKey === interactionDateKey;
}

export function buildRenderableTimelineItems({
  items,
  activityKinds,
  showActorInCluster,
  presentationPage,
  viewedBlogName,
}: BuildRenderableTimelineItemsArgs): RenderableTimelineItem[] {
  const renderable: RenderableTimelineItem[] = [];
  let currentRun: ActivityRunBucket | null = null;
  let runIndex = 0;

  const endCurrentRun = () => {
    currentRun = null;
  };

  const createRun = (kind: 'like' | 'comment', actor: string, actorKey: string): ActivityRunBucket => ({
      key: `run:${runIndex += 1}`,
      kind,
      actor,
      actorKey,
      likeCount: 0,
      commentCount: 0,
      oldestInteractionUnix: 0,
      latestInteractionUnix: 0,
      interactions: [],
      interactionIndex: new Map<number, number>(),
    });

  for (const item of items) {
    const kind = inferTimelineItemKind(item, presentationPage);
    if (!activityKinds.includes(kind)) {
      continue;
    }

    if (item.type === 1 && item.post) {
      endCurrentRun();
      renderable.push({ type: 'post', post: item.post as ProcessedPost });
      continue;
    }

    if (item.type !== 2 || !item.cluster) {
      endCurrentRun();
      continue;
    }

    if (kind === 'reblog') {
      endCurrentRun();
      for (const raw of (item.cluster.interactions || [])) {
        const post = raw as ProcessedPost;
        renderable.push({
          type: 'post',
          post: {
            ...post,
            _activityCreatedAtUnix: getTimelineInteractionUnix(post),
          },
        });
      }
      continue;
    }

    if (kind !== 'like' && kind !== 'comment') {
      endCurrentRun();
      continue;
    }

    const interactions = (item.cluster.interactions || [])
      .map((raw) => raw as ProcessedPost)
      .filter((post) => !shouldSuppressSelfSameDayLike(post, kind, presentationPage, showActorInCluster, viewedBlogName));

    if (interactions.length === 0) {
      continue;
    }

    const actorLabel = showActorInCluster ? (interactions[0].blogName || '') : '';
    const actorKey = normalizeBlogName(interactions[0].blogName);
    if (!currentRun || currentRun.kind !== kind || currentRun.actorKey !== actorKey) {
      currentRun = createRun(kind, actorLabel, actorKey);
      renderable.push({ type: 'activity-bucket', bucket: currentRun });
    }
    const run: ActivityRunBucket = currentRun;

    for (const post of interactions) {
      const interactionUnix = getTimelineInteractionUnix(post);

      if (!run.latestInteractionUnix || interactionUnix > run.latestInteractionUnix) {
        run.latestInteractionUnix = interactionUnix;
      }
      if (!run.oldestInteractionUnix || interactionUnix < run.oldestInteractionUnix) {
        run.oldestInteractionUnix = interactionUnix;
      }

      if (!Number.isFinite(post.id)) {
        run.interactions.push({ post, type: kind });
        if (kind === 'like') run.likeCount += 1;
        if (kind === 'comment') run.commentCount += 1;
        continue;
      }

      const existingIndex = run.interactionIndex.get(post.id);
      if (existingIndex === undefined) {
        run.interactionIndex.set(post.id, run.interactions.length);
        run.interactions.push({ post, type: kind });
        if (kind === 'like') run.likeCount += 1;
        if (kind === 'comment') run.commentCount += 1;
      }
    }
  }

  return renderable;
}
