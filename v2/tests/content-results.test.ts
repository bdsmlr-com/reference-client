import { describe, expect, it } from 'vitest';

import { contentGridItems, flattenContentResultPosts, prepareContentResultUnits } from '../src/services/content-results.js';
import type { SearchResultUnit } from '../src/services/search-result-units.js';
import type { ViewStats } from '../src/types/post.js';

describe('content-results helpers', () => {
  it('prepares units, dedupes by post id, and preserves grouped survivors', () => {
    const stats: ViewStats = { found: 0, deleted: 0, dupes: 0, notFound: 0 };
    const seenIds = new Set<number>();
    const units = [
      { kind: 'post', post: { id: 1, type: 1, blogName: 'one' } },
      {
        kind: 'result_group',
        group: {
          label: 'Reblogs',
          count: 2,
          originPostId: 10,
          posts: [
            { id: 1, type: 1, blogName: 'dupe' },
            { id: 2, type: 1, blogName: 'two' },
          ],
        },
      },
    ] satisfies SearchResultUnit[];

    const prepared = prepareContentResultUnits({ units, seenIds, stats });

    expect(prepared).toHaveLength(2);
    expect(prepared[0].kind).toBe('post');
    expect(prepared[1].kind).toBe('result_group');
    expect(prepared[1].kind === 'result_group' && prepared[1].group.posts).toHaveLength(1);
    expect(stats.dupes).toBe(1);
    expect(contentGridItems(prepared)).toHaveLength(2);
    expect(flattenContentResultPosts(prepared).map((post) => post.id)).toEqual([1, 2]);
  });
});
