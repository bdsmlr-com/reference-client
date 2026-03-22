import { describe, it, expect } from 'vitest';
import { mergeFollowEdges, shouldStopFollowPagination } from '../src/services/follow-pagination';
import type { FollowEdge } from '../src/types/api';

describe('social follow pagination safeguards', () => {
  it('deduplicates follow edges by blogId while preserving order', () => {
    const existing: FollowEdge[] = [
      { blogId: 1, blogName: 'a' },
      { blogId: 2, blogName: 'b' },
    ];
    const incoming: FollowEdge[] = [
      { blogId: 2, blogName: 'b' },
      { blogId: 3, blogName: 'c' },
    ];

    const merged = mergeFollowEdges(existing, incoming);
    expect(merged.map((e) => e.blogId)).toEqual([1, 2, 3]);
  });

  it('stops when cursor does not advance', () => {
    expect(
      shouldStopFollowPagination({
        previousCursor: 'abc',
        nextCursor: 'abc',
        incomingCount: 100,
        newlyAddedCount: 100,
      })
    ).toBe(true);
  });

  it('stops when page adds zero new edges', () => {
    expect(
      shouldStopFollowPagination({
        previousCursor: 'abc',
        nextCursor: 'def',
        incomingCount: 100,
        newlyAddedCount: 0,
      })
    ).toBe(true);
  });

  it('continues when cursor advances and new edges were added', () => {
    expect(
      shouldStopFollowPagination({
        previousCursor: 'abc',
        nextCursor: 'def',
        incomingCount: 100,
        newlyAddedCount: 42,
      })
    ).toBe(false);
  });
});
