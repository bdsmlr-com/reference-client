import { describe, expect, it } from 'vitest';
import { materializeSearchResultUnits } from '../src/services/search-result-units.js';
import type { SearchPostsByTagResponse } from '../src/types/api.js';

describe('search result units', () => {
  it('treats posts as canonical post result units', () => {
    const response: SearchPostsByTagResponse = {
      posts: [
        { id: 101, type: 1, blogId: 1 },
        { id: 102, type: 1, blogId: 1 },
      ],
    };

    expect(materializeSearchResultUnits(response)).toEqual([
      { kind: 'post', post: { id: 101, type: 1, blogId: 1 } },
      { kind: 'post', post: { id: 102, type: 1, blogId: 1 } },
    ]);
  });

  it('prefers canonical grouped result units over flat compatibility posts', () => {
    const response: SearchPostsByTagResponse = {
      posts: [{ id: 999, type: 1, blogId: 9 }],
      resultUnits: [
        {
          reblogGroup: {
            label: 'Reblogs',
            originPostId: 1234,
            representativePostId: 201,
            count: 7,
            posts: [{ id: 201, type: 1, blogId: 2 }],
          },
        },
      ],
    };

    expect(materializeSearchResultUnits(response)).toEqual([
      {
        kind: 'result_group',
        group: {
          label: 'Reblogs',
          count: 7,
          originPostId: 1234,
          representativePostId: 201,
          posts: [{ id: 201, type: 1, blogId: 2 }],
        },
      },
    ]);
  });

  it('keeps search responses flat and timeline-free at the contract layer', () => {
    const response = {} as SearchPostsByTagResponse;
    expect(materializeSearchResultUnits(response)).toEqual([]);
  });
});
