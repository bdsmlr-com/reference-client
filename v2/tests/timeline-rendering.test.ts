import { describe, it, expect } from 'vitest';
import { buildRenderableTimelineItems } from '../src/services/timeline-rendering.js';
import type { TimelineItem } from '../src/types/api.js';
import type { ProcessedPost } from '../src/types/post.js';

function makePost(id: number, blogName: string, createdAtUnix: number, updatedAtUnix: number): ProcessedPost {
  return {
    id,
    blogName,
    originBlogName: blogName,
    originBlogId: id,
    blogId: id,
    originPostId: id,
    createdAtUnix,
    updatedAtUnix,
    likesCount: 0,
    reblogsCount: 0,
    commentsCount: 0,
    tags: [],
    type: 2,
    variant: 1,
    body: '',
    title: '',
    content: {
      files: [],
      html: '',
      text: null,
      title: null,
      url: null,
      thumbnail: null,
      description: null,
      quoteText: null,
      quoteSource: null,
    },
    _media: { type: 'image', url: '' },
  } as ProcessedPost;
}

function makeCluster(label: string, posts: ProcessedPost[]): TimelineItem {
  return {
    type: 2,
    cluster: {
      label,
      interactions: posts,
    },
  } as TimelineItem;
}

describe('timeline rendering', () => {
  it('collapses contiguous like runs and dedupes repeated posts within the run', () => {
    const items: TimelineItem[] = [
      makeCluster('Likes', [makePost(1, 'Actor', 1700000000, 1710000000)]),
      makeCluster('Likes', [
        makePost(2, 'Actor', 1700001000, 1709900000),
        makePost(1, 'Actor', 1700000000, 1709800000),
      ]),
    ];

    const renderable = buildRenderableTimelineItems({
      items,
      activityKinds: ['like', 'comment', 'post', 'reblog'],
      showActorInCluster: false,
      presentationPage: 'activity',
      viewedBlogName: 'Actor',
    });

    expect(renderable).toHaveLength(1);
    expect(renderable[0].type).toBe('activity-bucket');
    if (renderable[0].type !== 'activity-bucket') return;
    expect(renderable[0].bucket.likeCount).toBe(2);
    expect(renderable[0].bucket.commentCount).toBe(0);
    expect(renderable[0].bucket.interactions.map((item) => item.post.id)).toEqual([1, 2]);
  });

  it('keeps different activity kinds in separate runs even for the same post', () => {
    const repeated = makePost(10, 'Actor', 1700000000, 1710000000);
    const items: TimelineItem[] = [
      makeCluster('Likes', [repeated]),
      makeCluster('Comments', [repeated]),
      makeCluster('Likes', [makePost(11, 'Actor', 1700002000, 1709900000)]),
    ];

    const renderable = buildRenderableTimelineItems({
      items,
      activityKinds: ['like', 'comment', 'post', 'reblog'],
      showActorInCluster: false,
      presentationPage: 'activity',
      viewedBlogName: 'Actor',
    });

    expect(renderable).toHaveLength(3);
    expect(renderable.every((item) => item.type === 'activity-bucket')).toBe(true);
    if (renderable.some((item) => item.type !== 'activity-bucket')) return;
    expect(renderable.map((item) => item.bucket.kind)).toEqual(['like', 'comment', 'like']);
    expect(renderable.map((item) => item.bucket.interactions[0].post.id)).toEqual([10, 10, 11]);
  });
});
