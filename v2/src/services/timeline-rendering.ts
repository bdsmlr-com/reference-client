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
  actorBoundaryKey: string;
  sourceClusterKey: string;
  likeCount: number;
  commentCount: number;
  oldestInteractionUnix: number;
  latestInteractionUnix: number;
  interactions: BucketInteraction[];
  interactionIndex: Map<string, number>;
};

export type RenderableTimelineItem =
  | { type: 'post'; post: ProcessedPost }
  | { type: 'activity-bucket'; bucket: ActivityRunBucket };

type BuildRenderableTimelineItemsArgs = {
  items: TimelineItem[];
  activityKinds: ActivityKind[];
  interactionGroupingMode: 'date' | 'date+actor';
  activityCardVariant: 'self-context' | 'actor-context';
  presentationPage: 'feed' | 'activity';
  viewedBlogName: string;
};

type TimelineEvent =
  | {
      kind: 'post' | 'reblog';
      ts: number;
      sequence: number;
      post: ProcessedPost;
    }
  | {
      kind: 'like' | 'comment';
      ts: number;
      sequence: number;
      post: ProcessedPost;
      actor: string;
      actorKey: string;
      sourceClusterKey: string;
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


function getInteractionDedupKey(post: ProcessedPost): string {
  if (post.originPostId) return `origin:${post.originPostId}`;
  if (Number.isFinite(post.id)) return `post:${post.id}`;
  const mediaUrl = post._media?.url || post._media?.videoUrl || post._media?.audioUrl || '';
  return mediaUrl ? `media:${mediaUrl.split('?')[0]}` : `fallback:${post.blogId || ''}:${post.createdAtUnix || 0}`;
}

function shouldPreferInteractionPost(candidate: ProcessedPost, incumbent: ProcessedPost): boolean {
  const candidateIsReblog = Boolean(candidate.originPostId && candidate.originPostId !== candidate.id);
  const incumbentIsReblog = Boolean(incumbent.originPostId && incumbent.originPostId !== incumbent.id);
  if (candidateIsReblog !== incumbentIsReblog) return candidateIsReblog;
  return getTimelineInteractionUnix(candidate) > getTimelineInteractionUnix(incumbent);
}

function shouldSuppressSelfSameDayLike(
  post: ProcessedPost,
  kind: ActivityKind,
  presentationPage: 'feed' | 'activity',
  activityCardVariant: 'self-context' | 'actor-context',
  viewedBlogName: string,
): boolean {
  if (kind !== 'like' || activityCardVariant === 'actor-context') return false;
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

function buildTimelineEvents({
  items,
  activityKinds,
  activityCardVariant,
  presentationPage,
  viewedBlogName,
}: BuildRenderableTimelineItemsArgs): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let sequence = 0;

  for (const item of items) {
    const kind = inferTimelineItemKind(item, presentationPage);
    if (!activityKinds.includes(kind)) {
      continue;
    }

    if (item.type === 1 && item.post) {
      const post = item.post as ProcessedPost;
      const ts = post.createdAtUnix || post.updatedAtUnix || getTimelineInteractionUnix(post);
      const eventKind: 'post' | 'reblog' = kind === 'reblog' ? 'reblog' : 'post';
      events.push({ kind: eventKind, ts, sequence: sequence++, post });
      continue;
    }

    if (item.type !== 2 || !item.cluster) {
      continue;
    }

    const clusterPosts = (item.cluster.interactions || []).map((raw) => raw as ProcessedPost);
    const sourceClusterKey = item.cluster.sourceBoundaryKey || "";

    if (kind === 'reblog') {
      for (const post of clusterPosts) {
        events.push({
          kind: 'reblog',
          ts: getTimelineInteractionUnix(post),
          sequence: sequence++,
          post: {
            ...post,
            _activityCreatedAtUnix: getTimelineInteractionUnix(post),
          },
        });
      }
      continue;
    }

    if (kind !== 'like' && kind !== 'comment') {
      continue;
    }

    const interactions = clusterPosts.filter((post) => !shouldSuppressSelfSameDayLike(post, kind, presentationPage, activityCardVariant, viewedBlogName));
    for (const post of interactions) {
      events.push({
        kind,
        ts: getTimelineInteractionUnix(post),
        sequence: sequence++,
        post,
        actor: activityCardVariant === 'actor-context' ? (post.blogName || '') : '',
        actorKey: activityCardVariant === 'actor-context' ? normalizeBlogName(post.blogName) : '',
        sourceClusterKey,
      });
    }
  }

  events.sort((a, b) => {
    if (b.ts !== a.ts) return b.ts - a.ts;
    return a.sequence - b.sequence;
  });
  return events;
}

export function buildRenderableTimelineItems(args: BuildRenderableTimelineItemsArgs): RenderableTimelineItem[] {
  const renderable: RenderableTimelineItem[] = [];
  let currentRun: ActivityRunBucket | null = null;
  let runIndex = 0;

  const endCurrentRun = () => {
    currentRun = null;
  };

  const createRun = (kind: 'like' | 'comment', actor: string, actorBoundaryKey: string, sourceClusterKey: string): ActivityRunBucket => ({
    key: `run:${runIndex += 1}`,
    kind,
    actor,
    actorBoundaryKey,
    likeCount: 0,
    commentCount: 0,
    oldestInteractionUnix: 0,
    latestInteractionUnix: 0,
    interactions: [],
    interactionIndex: new Map<string, number>(),
    sourceClusterKey,
  } as ActivityRunBucket & { sourceClusterKey: string });

  const events = buildTimelineEvents(args);

  for (const event of events) {
    if (event.kind === 'post' || event.kind === 'reblog') {
      endCurrentRun();
      renderable.push({ type: 'post', post: event.post });
      continue;
    }

    const interactionEvent = event as Extract<TimelineEvent, { kind: 'like' | 'comment' }>;

    const actorBoundaryKey = args.interactionGroupingMode === 'date+actor' ? interactionEvent.actorKey : '';

    if (!currentRun || currentRun.kind !== interactionEvent.kind || currentRun.actorBoundaryKey !== actorBoundaryKey || currentRun.sourceClusterKey !== interactionEvent.sourceClusterKey) {
      currentRun = createRun(interactionEvent.kind, interactionEvent.actor, actorBoundaryKey, interactionEvent.sourceClusterKey);
      renderable.push({ type: 'activity-bucket', bucket: currentRun });
    }
    const run: ActivityRunBucket = currentRun;
    const interactionUnix = interactionEvent.ts;

    if (!run.latestInteractionUnix || interactionUnix > run.latestInteractionUnix) {
      run.latestInteractionUnix = interactionUnix;
    }
    if (!run.oldestInteractionUnix || interactionUnix < run.oldestInteractionUnix) {
      run.oldestInteractionUnix = interactionUnix;
    }

    const post = interactionEvent.post;
    if (!Number.isFinite(post.id)) {
      run.interactions.push({ post, type: interactionEvent.kind });
      if (interactionEvent.kind === 'like') run.likeCount += 1;
      if (interactionEvent.kind === 'comment') run.commentCount += 1;
      continue;
    }

    const dedupKey = getInteractionDedupKey(post);
    const existingIndex = run.interactionIndex.get(dedupKey);
    if (existingIndex === undefined) {
      run.interactionIndex.set(dedupKey, run.interactions.length);
      run.interactions.push({ post, type: interactionEvent.kind });
      if (interactionEvent.kind === 'like') run.likeCount += 1;
      if (interactionEvent.kind === 'comment') run.commentCount += 1;
      continue;
    }

    const incumbent = run.interactions[existingIndex]?.post;
    if (incumbent && shouldPreferInteractionPost(post, incumbent)) {
      run.interactions[existingIndex] = { post, type: interactionEvent.kind };
    }
  }

  return renderable;
}
