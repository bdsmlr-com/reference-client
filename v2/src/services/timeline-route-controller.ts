import type { PostType } from '../types/api.js';
import {
  DEFAULT_ACTIVITY_KINDS,
  getBlogActivityKindsPreference,
  getFollowerFeedActivityKindsPreference,
  getFollowingActivityKindsPreference,
  normalizeActivityKinds,
  setBlogActivityKindsPreference,
  setFollowerFeedActivityKindsPreference,
  setFollowingActivityKindsPreference,
  type ActivityKind,
} from './profile.js';
import {
  ALL_POST_TYPES,
  parsePostTypesParam,
  serializePostTypesParam,
} from './post-filter-url.js';

export type TimelineRouteKind = 'following' | 'followers' | 'activity';
export type TimelineStreamPage = 'feed' | 'follower-feed' | 'activity';
export type TimelineFooterMode = 'timeline' | 'activity';

type TimelineRouteDefinition = {
  streamPage: TimelineStreamPage;
  showActorInCluster: boolean;
  footerMode: TimelineFooterMode;
  footerPageName: string;
  controlPageName: string;
  readStoredActivityKinds: () => ActivityKind[];
  writeStoredActivityKinds: (kinds: ActivityKind[]) => void;
};

const TIMELINE_ROUTE_DEFINITIONS: Record<TimelineRouteKind, TimelineRouteDefinition> = {
  following: {
    streamPage: 'feed',
    showActorInCluster: true,
    footerMode: 'activity',
    footerPageName: 'following',
    controlPageName: 'following',
    readStoredActivityKinds: getFollowingActivityKindsPreference,
    writeStoredActivityKinds: setFollowingActivityKindsPreference,
  },
  followers: {
    streamPage: 'follower-feed',
    showActorInCluster: true,
    footerMode: 'activity',
    footerPageName: 'followers',
    controlPageName: 'followers',
    readStoredActivityKinds: getFollowerFeedActivityKindsPreference,
    writeStoredActivityKinds: setFollowerFeedActivityKindsPreference,
  },
  activity: {
    streamPage: 'activity',
    showActorInCluster: false,
    footerMode: 'timeline',
    footerPageName: 'timeline',
    controlPageName: 'timeline',
    readStoredActivityKinds: getBlogActivityKindsPreference,
    writeStoredActivityKinds: setBlogActivityKindsPreference,
  },
};

export function getTimelineRouteDefinition(route: TimelineRouteKind): TimelineRouteDefinition {
  return TIMELINE_ROUTE_DEFINITIONS[route];
}

export function readTimelineRouteQueryState(
  route: TimelineRouteKind,
  params: { types?: string | null; activity?: string | null },
): { selectedTypes: PostType[]; activityKinds: ActivityKind[] } {
  const definition = getTimelineRouteDefinition(route);
  return {
    selectedTypes: parsePostTypesParam(params.types) ?? [...ALL_POST_TYPES],
    activityKinds: normalizeActivityKinds(params.activity ?? null, definition.readStoredActivityKinds()),
  };
}

export function buildTimelineRouteQueryParams(
  state: { selectedTypes: PostType[]; activityKinds: ActivityKind[] },
): { types: string; activity: string } {
  const selectedTypes = parsePostTypesParam(serializePostTypesParam(state.selectedTypes)) ?? [...ALL_POST_TYPES];
  const activityKinds = normalizeActivityKinds(state.activityKinds.join(','), DEFAULT_ACTIVITY_KINDS);

  return {
    types: isDefaultTypeSelection(selectedTypes) ? '' : serializePostTypesParam(selectedTypes),
    activity: isDefaultActivitySelection(activityKinds) ? '' : activityKinds.join(','),
  };
}

export function shouldLoadMoreTimeline(state: {
  infiniteScroll: boolean;
  loading: boolean;
  exhausted: boolean;
  hasSourceData?: boolean;
}): boolean {
  return state.infiniteScroll && !state.loading && !state.exhausted && (state.hasSourceData ?? true);
}

function isDefaultTypeSelection(selectedTypes: PostType[]): boolean {
  return serializePostTypesParam(selectedTypes) === serializePostTypesParam(ALL_POST_TYPES);
}

function isDefaultActivitySelection(activityKinds: ActivityKind[]): boolean {
  return activityKinds.join(',') === DEFAULT_ACTIVITY_KINDS.join(',');
}
