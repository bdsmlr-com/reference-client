import type { AffinityTag, BlogTagAffinity, Tag } from '../types/api.js';

export type AffinityInteractionMode = 'both' | 'likes' | 'reblogs';
export type AffinityHorizon = 'recent' | 'all';

function quoteTokenIfNeeded(value: string): string {
  if (/^[A-Za-z0-9_-]+$/.test(value)) {
    return value;
  }
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function buildAffinityTagExpression(tag: string): string {
  return `tag:${quoteTokenIfNeeded(tag.trim())}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toggleAffinityTagExpression(query: string, tag: string): string {
  const expression = buildAffinityTagExpression(tag);
  const trimmed = query.trim();
  if (!trimmed) {
    return expression;
  }
  const matcher = new RegExp(`(^|\\s+)${escapeRegex(expression)}(?=\\s+|$)`, 'g');
  if (matcher.test(trimmed)) {
    return trimmed.replace(matcher, ' ').replace(/\s+/g, ' ').trim();
  }
  return `${trimmed} ${expression}`;
}

export function affinityTagsToCloudTags(entries: AffinityTag[] | undefined): Tag[] {
  return (entries || []).map((entry) => ({ name: entry.tag, postsCount: entry.count }));
}

export function selectAffinityBucket(
  affinity: BlogTagAffinity | null | undefined,
  horizon: AffinityHorizon,
  interactionMode: AffinityInteractionMode,
): Tag[] {
  if (!affinity) {
    return [];
  }
  return affinityTagsToCloudTags(affinity[horizon]?.[interactionMode] || []);
}
