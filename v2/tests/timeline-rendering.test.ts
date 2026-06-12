import { describe, it, expect } from 'vitest';
import { buildRenderableTimelineItems } from '../src/services/timeline-rendering.js';
import type { TimelineItem } from '../src/types/api.js';
import type { ProcessedPost } from '../src/types/post.js';

function makePost(id: number, blogName: string, createdAtUnix: number, updatedAtUnix: number, overrides: Partial<ProcessedPost> = {}): ProcessedPost {
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
    ...overrides,
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


  it('splits activity buckets when older interactions would fall behind a newer post card', () => {
    const likeNew = makePost(1, 'Actor', 1700000000, 1710000000);
    likeNew._activityCreatedAtUnix = 1710000000;
    const likeOld = makePost(2, 'Actor', 1700000000, 1708000000);
    likeOld._activityCreatedAtUnix = 1708000000;
    const interveningPost = makePost(3, 'Actor', 1709000000, 1709000000);
    const items: TimelineItem[] = [
      makeCluster('Likes', [likeNew, likeOld]),
      { type: 1, post: interveningPost } as TimelineItem,
    ];

    const renderable = buildRenderableTimelineItems({
      items,
      activityKinds: ['like', 'comment', 'post', 'reblog'],
      showActorInCluster: false,
      presentationPage: 'activity',
      viewedBlogName: 'Actor',
    });

    expect(renderable).toHaveLength(3);
    expect(renderable[0].type).toBe('activity-bucket');
    expect(renderable[1].type).toBe('post');
    expect(renderable[2].type).toBe('activity-bucket');
    if (renderable[0].type !== 'activity-bucket' || renderable[2].type !== 'activity-bucket' || renderable[1].type !== 'post') return;
    expect(renderable[0].bucket.interactions.map((item) => item.post.id)).toEqual([1]);
    expect(renderable[1].post.id).toBe(3);
    expect(renderable[2].bucket.interactions.map((item) => item.post.id)).toEqual([2]);
  });


  it('dedupes origin/reblog twins inside an activity bucket and prefers the reblog artifact', () => {
    const original = makePost(496441965, 'GrandpaJames', 1700000000, 1710000000, {
      originPostId: 496441965,
      blogId: 1,
      originBlogId: 1,
    });
    original._activityCreatedAtUnix = 1710000000;
    const reblog = makePost(870224235, 'GrandpaJames', 1700001000, 1710000001, {
      originPostId: 496441965,
      blogId: 2,
      originBlogId: 1,
    });
    reblog._activityCreatedAtUnix = 1710000001;

    const renderable = buildRenderableTimelineItems({
      items: [makeCluster('Likes', [original, reblog])],
      activityKinds: ['like', 'comment', 'post', 'reblog'],
      showActorInCluster: false,
      presentationPage: 'activity',
      viewedBlogName: 'someoneelse',
    });

    expect(renderable).toHaveLength(1);
    expect(renderable[0].type).toBe('activity-bucket');
    if (renderable[0].type !== 'activity-bucket') return;
    expect(renderable[0].bucket.likeCount).toBe(1);
    expect(renderable[0].bucket.interactions).toHaveLength(1);
    expect(renderable[0].bucket.interactions[0].post.id).toBe(870224235);
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


it('keeps separate backend interaction clusters as separate buckets', () => {
  const first = {
    type: 2,
    cluster: {
      label: 'Likes',
      sourceBoundaryKey: 'page:abc:0',
      interactions: [
        { id: 101, blogName: 'actor-a', createdAtUnix: 1700000000, updatedAtUnix: 1700000100, _activityCreatedAtUnix: 1700000100 },
      ],
    },
  } as any;
  const second = {
    type: 2,
    cluster: {
      label: 'Likes',
      sourceBoundaryKey: 'page:def:0',
      interactions: [
        { id: 102, blogName: 'actor-a', createdAtUnix: 1699999000, updatedAtUnix: 1699999900, _activityCreatedAtUnix: 1699999900 },
      ],
    },
  } as any;

  const renderable = buildRenderableTimelineItems({
    items: [first, second],
    activityKinds: ['like'],
    showActorInCluster: false,
    presentationPage: 'activity',
    viewedBlogName: 'demo-blog',
  });

  expect(renderable).toHaveLength(2);
  expect(renderable[0].type).toBe('activity-bucket');
  expect(renderable[1].type).toBe('activity-bucket');
});
