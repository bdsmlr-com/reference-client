import type { Post, SearchPostsByTagResponse } from '../types/api.js';

export interface SearchPostResultUnit {
  kind: 'post';
  post: Post;
}

export interface SearchResultGroupUnit {
  kind: 'result_group';
  group: {
    label: string;
    posts: Post[];
  };
}

export type SearchResultUnit = SearchPostResultUnit | SearchResultGroupUnit;

export function materializeSearchResultUnits(resp: SearchPostsByTagResponse): SearchResultUnit[] {
  if (resp.posts && resp.posts.length > 0) {
    return resp.posts.map((post) => ({ kind: 'post', post }));
  }

  return (resp.timelineItems || []).reduce<SearchResultUnit[]>((units, item) => {
    if (item.type === 1 && item.post) {
      units.push({ kind: 'post', post: item.post } satisfies SearchPostResultUnit);
      return units;
    }
    if (item.type === 2 && item.cluster?.interactions?.length) {
      units.push({
        kind: 'result_group',
        group: {
          label: item.cluster.label || 'Grouped results',
          posts: item.cluster.interactions,
        },
      } satisfies SearchResultGroupUnit);
      return units;
    }
    return units;
  }, []);
}
