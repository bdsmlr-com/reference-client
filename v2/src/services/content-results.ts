import { extractMedia, type ProcessedPost, type ViewStats } from '../types/post.js';
import type { SearchResultUnit } from './search-result-units.js';
import { toPresentationModel } from './post-presentation.js';

export type ContentGridItem =
  | { post: ProcessedPost; type: 'post' | 'reblog' }
  | { kind: 'result_group'; post: ProcessedPost; count: number; label: string; originPostId: number };

interface PrepareContentResultUnitsOptions {
  units: SearchResultUnit[];
  seenIds: Set<number>;
  stats: ViewStats;
  allowDuplicateIds?: boolean;
}

export function prepareContentResultUnits({
  units,
  seenIds,
  stats,
  allowDuplicateIds = false,
}: PrepareContentResultUnitsOptions): SearchResultUnit[] {
  const preparePost = (post: ProcessedPost): ProcessedPost | null => {
    if (!allowDuplicateIds && seenIds.has(post.id)) {
      stats.dupes++;
      return null;
    }
    seenIds.add(post.id);
    post._media = extractMedia(post);
    return post;
  };

  const preparedUnits: SearchResultUnit[] = [];
  units.forEach((unit) => {
    if (unit.kind === 'post') {
      const prepared = preparePost(unit.post as ProcessedPost);
      if (prepared) {
        preparedUnits.push({ kind: 'post', post: prepared });
      }
      return;
    }

    const posts = unit.group.posts
      .map((post) => preparePost(post as ProcessedPost))
      .filter((post): post is ProcessedPost => post !== null);
    if (posts.length === 0) {
      return;
    }
    preparedUnits.push({
      kind: 'result_group',
      group: {
        label: unit.group.label,
        count: unit.group.count,
        originPostId: unit.group.originPostId,
        representativePostId: unit.group.representativePostId,
        posts,
      },
    });
  });
  return preparedUnits;
}

export function contentGridItems(units: SearchResultUnit[]): ContentGridItem[] {
  const items: ContentGridItem[] = [];
  units.forEach((unit) => {
    if (unit.kind === 'post') {
      const presentation = toPresentationModel(unit.post as ProcessedPost, { surface: 'card', page: 'activity' });
      items.push({
        post: unit.post as ProcessedPost,
        type: presentation.identity.isReblog ? 'reblog' : 'post',
      });
      return;
    }
    const representative = unit.group.posts[0] as ProcessedPost | undefined;
    if (!representative) return;
    items.push({
      kind: 'result_group',
      post: representative,
      count: unit.group.count || unit.group.posts.length,
      label: unit.group.label,
      originPostId: unit.group.originPostId || representative.originPostId || representative.id,
    });
  });
  return items;
}

export function flattenContentResultPosts(units: SearchResultUnit[]): ProcessedPost[] {
  return units.flatMap((unit) =>
    unit.kind === 'post' ? [unit.post as ProcessedPost] : unit.group.posts.map((post) => post as ProcessedPost),
  );
}
