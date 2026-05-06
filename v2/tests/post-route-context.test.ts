import { describe, expect, it } from 'vitest';
import {
  buildContextualTagSearchHref,
  buildPostHref,
  inferPostSourceFromPath,
  normalizePostSource,
} from '../src/services/post-route-context.js';
import type { ProcessedPost } from '../src/types/post.js';

function makePost(overrides: Partial<ProcessedPost> = {}): ProcessedPost {
  return {
    id: 43110814,
    blogId: 101,
    blogName: 'inner-indulgence',
    originBlogName: 'bestservedhot',
    originPostId: 847947149,
    tags: [],
    _media: { type: 'image', url: '/uploads/foo.jpg' } as any,
    ...overrides,
  } as ProcessedPost;
}

describe('post route context', () => {
  it('normalizes supported post sources', () => {
    expect(normalizePostSource('search')).toBe('search');
    expect(normalizePostSource('archive')).toBe('archive');
    expect(normalizePostSource('activity')).toBe('activity');
    expect(normalizePostSource('feed')).toBe('feed');
    expect(normalizePostSource('follower-feed')).toBe('follower-feed');
    expect(normalizePostSource('social')).toBe('social');
    expect(normalizePostSource('unknown')).toBe('direct');
  });

  it('infers route provenance from the current pathname', () => {
    expect(inferPostSourceFromPath('/search?q=ddlg')).toBe('search');
    expect(inferPostSourceFromPath('/archive/opstestacc')).toBe('archive');
    expect(inferPostSourceFromPath('/activity/opstestacc')).toBe('activity');
    expect(inferPostSourceFromPath('/feed/for/you')).toBe('feed');
    expect(inferPostSourceFromPath('/follower-feed/you')).toBe('follower-feed');
    expect(inferPostSourceFromPath('/post/43110814')).toBe('direct');
  });

  it('builds post hrefs with explicit provenance', () => {
    expect(buildPostHref(43110814, 'search')).toBe('/post/43110814?from=search');
    expect(buildPostHref(43110814, 'direct')).toBe('/post/43110814');
  });

  it('keeps plain search tags unscoped for search provenance', () => {
    expect(buildContextualTagSearchHref('best served hot', makePost(), 'search')).toBe(
      '/search?q=tag%3A%22best%20served%20hot%22',
    );
  });

  it('scopes archive and activity tags to the visible via blog', () => {
    expect(buildContextualTagSearchHref('ddlg', makePost(), 'archive')).toBe(
      '/search?q=tag%3Addlg%20blog%3Ainner-indulgence',
    );
    expect(buildContextualTagSearchHref('ddlg', makePost(), 'activity')).toBe(
      '/search?q=tag%3Addlg%20blog%3Ainner-indulgence',
    );
  });

  it('lets feed provenance search both origin and via blogs for reblogs', () => {
    expect(buildContextualTagSearchHref('ddlg', makePost(), 'feed')).toBe(
      '/search?q=tag%3Addlg%20(blog%3Abestservedhot%20%7C%20blog%3Ainner-indulgence)',
    );
    expect(buildContextualTagSearchHref('ddlg', makePost(), 'social')).toBe(
      '/search?q=tag%3Addlg%20(blog%3Abestservedhot%20%7C%20blog%3Ainner-indulgence)',
    );
  });
});
