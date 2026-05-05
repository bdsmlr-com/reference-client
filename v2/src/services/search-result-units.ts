import type { Post, SearchPostsByTagResponse, TimelineItem } from '../types/api.js';

export interface SearchPostResultUnit {
  kind: 'post';
  post: Post;
}

export interface SearchResultGroupUnit {
  kind: 'result_group';
  group: {
    label: string;
    count?: number;
    originPostId?: number;
    representativePostId?: number;
    posts: Post[];
  };
}

export type SearchResultUnit = SearchPostResultUnit | SearchResultGroupUnit;

export function materializeSearchResultUnits(resp: SearchPostsByTagResponse): SearchResultUnit[] {
  if (resp.resultUnits && resp.resultUnits.length > 0) {
    return resp.resultUnits.reduce<SearchResultUnit[]>((units, item) => {
      if (item.post) {
        units.push({ kind: 'post', post: item.post } satisfies SearchPostResultUnit);
        return units;
      }
      if (item.reblogGroup?.posts?.length) {
        units.push({
          kind: 'result_group',
          group: {
            label: item.reblogGroup.label || 'Reblogs',
            count: item.reblogGroup.count,
            originPostId: item.reblogGroup.originPostId,
            representativePostId: item.reblogGroup.representativePostId,
            posts: item.reblogGroup.posts,
          },
        } satisfies SearchResultGroupUnit);
      }
      return units;
    }, []);
  }

  if (resp.posts && resp.posts.length > 0) {
    return resp.posts.map((post) => ({ kind: 'post', post }));
  }

  const legacyTimelineItems = (resp as { timelineItems?: TimelineItem[] }).timelineItems;
  return materializeLegacySearchResultUnits(legacyTimelineItems);
}

/**
 * Temporary adapter seam for legacy search payloads that still arrive in the
 * older timeline-shaped form. Search should not depend on this long-term.
 */
export function materializeLegacySearchResultUnits(
  timelineItems?: TimelineItem[],
): SearchResultUnit[] {
  return (timelineItems || []).reduce<SearchResultUnit[]>((units, item) => {
    if (item.type === 1 && item.post) {
      units.push({ kind: 'post', post: item.post } satisfies SearchPostResultUnit);
      return units;
    }
    if (item.type === 2 && item.cluster?.interactions?.length) {
      units.push({
        kind: 'result_group',
        group: {
          label: item.cluster.label || 'Grouped results',
          count: item.cluster.interactions.length,
          posts: item.cluster.interactions,
        },
      } satisfies SearchResultGroupUnit);
      return units;
    }
    return units;
  }, []);
}
