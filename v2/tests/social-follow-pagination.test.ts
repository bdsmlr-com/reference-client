import { describe, it, expect } from 'vitest';
import {
  mergeFollowEdges,
  shouldStopFollowPagination,
  fingerprintFollowEdges,
} from '../src/services/follow-pagination';
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
        totalCount: 0,
        loadedCount: 42,
      })
    ).toBe(false);
  });

  it('stops when loaded items reach known total count', () => {
    expect(
      shouldStopFollowPagination({
        previousCursor: 'abc',
        nextCursor: 'def',
        incomingCount: 10,
        newlyAddedCount: 10,
        totalCount: 197,
        loadedCount: 197,
      })
    ).toBe(true);
  });

  it('deduplicates correctly when incoming edges use snake_case blog_id', () => {
    const existing = [{ blog_id: 100 } as unknown as FollowEdge];
    const incoming = [{ blog_id: 100 }, { blog_id: 101 }] as unknown as FollowEdge[];
    const merged = mergeFollowEdges(existing, incoming);
    const ids = merged.map((e: any) => e.blogId ?? e.blog_id);
    expect(ids).toEqual([100, 101]);
  });

  it('deduplicates structurally identical edges without stable ids', () => {
    const existing = [{ avatar: '/a.png', label: 'mystery' }] as unknown as FollowEdge[];
    const incoming = [{ avatar: '/a.png', label: 'mystery' }] as unknown as FollowEdge[];
    const merged = mergeFollowEdges(existing, incoming);
    expect(merged.length).toBe(1);
  });

  it('deduplicates same blogName even when ids differ across pages', () => {
    const existing = [{ blog_id: 100, blog_name: 'RepeatMe' }] as unknown as FollowEdge[];
    const incoming = [{ blog_id: 200, blog_name: 'repeatme' }] as unknown as FollowEdge[];
    const merged = mergeFollowEdges(existing, incoming);
    expect(merged.length).toBe(1);
  });

  it('stops when page fingerprint repeats', () => {
    const page = [{ blog_id: 77, blog_name: 'same' }] as unknown as FollowEdge[];
    const fp = fingerprintFollowEdges(page);
    expect(fp.length).toBeGreaterThan(0);
    expect(
      shouldStopFollowPagination({
        previousCursor: 'abc',
        nextCursor: 'def',
        incomingCount: 1,
        newlyAddedCount: 1,
        repeatedPage: true,
      })
    ).toBe(true);
  });
});
