import { describe, expect, it } from 'vitest';
import {
  buildTimelineRouteQueryParams,
  getTimelineRouteDefinition,
  readTimelineRouteQueryState,
  shouldLoadMoreTimeline,
} from '../src/services/timeline-route-controller.js';

describe('timeline route controller', () => {
  it('exposes distinct timeline route metadata without changing the fetch model', () => {
    expect(getTimelineRouteDefinition('following')).toMatchObject({
      streamPage: 'feed',
      showActorInCluster: true,
      footerMode: 'activity',
      footerPageName: 'following',
      controlPageName: 'following',
    });

    expect(getTimelineRouteDefinition('followers')).toMatchObject({
      streamPage: 'follower-feed',
      showActorInCluster: true,
      footerMode: 'activity',
      footerPageName: 'followers',
      controlPageName: 'followers',
    });

    expect(getTimelineRouteDefinition('activity')).toMatchObject({
      streamPage: 'activity',
      showActorInCluster: false,
      footerMode: 'timeline',
      footerPageName: 'timeline',
      controlPageName: 'timeline',
    });
  });

  it('normalizes shared type and activity query state', () => {
    const state = readTimelineRouteQueryState('activity', {
      types: 'image,video,2,video',
      activity: 'comment,like,invalid',
    });

    expect(state.selectedTypes).toEqual([2, 3]);
    expect(state.activityKinds).toEqual(['comment', 'like']);
  });

  it('serializes default selections to minimal query params', () => {
    expect(buildTimelineRouteQueryParams({
      selectedTypes: [1, 2, 3, 4, 5, 6, 7],
      activityKinds: ['post', 'reblog', 'like', 'comment'],
    })).toEqual({
      types: '',
      activity: '',
    });
  });

  it('serializes narrowed selections back to route query params', () => {
    expect(buildTimelineRouteQueryParams({
      selectedTypes: [2, 3],
      activityKinds: ['post', 'comment'],
    })).toEqual({
      types: 'image,video',
      activity: 'post,comment',
    });
  });

  it('gates infinite load-more behavior consistently across timeline routes', () => {
    expect(shouldLoadMoreTimeline({
      infiniteScroll: true,
      loading: false,
      exhausted: false,
      hasSourceData: true,
    })).toBe(true);

    expect(shouldLoadMoreTimeline({
      infiniteScroll: true,
      loading: false,
      exhausted: false,
      hasSourceData: false,
    })).toBe(false);

    expect(shouldLoadMoreTimeline({
      infiniteScroll: false,
      loading: false,
      exhausted: false,
      hasSourceData: true,
    })).toBe(false);
  });
});
