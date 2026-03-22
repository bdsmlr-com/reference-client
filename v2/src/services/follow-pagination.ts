import type { FollowEdge } from '../types/api';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function edgeKey(edge: FollowEdge): string | null {
  const raw = edge as unknown as {
    blogId?: number;
    blog_id?: number;
    blogName?: string;
    blog_name?: string;
    userId?: number;
    user_id?: number;
  };
  const blogId = raw.blogId ?? raw.blog_id;
  if (blogId !== undefined && blogId !== null) return `blog:${blogId}`;
  const blogName = raw.blogName ?? raw.blog_name;
  if (blogName) return `name:${blogName.toLowerCase()}`;
  const userId = raw.userId ?? raw.user_id;
  if (userId !== undefined && userId !== null) return `user:${userId}`;
  return `obj:${stableStringify(raw)}`;
}

export function mergeFollowEdges(existing: FollowEdge[], incoming: FollowEdge[]): FollowEdge[] {
  if (incoming.length === 0) return existing;
  const seen = new Set<string>();
  for (const edge of existing) {
    const key = edgeKey(edge);
    if (key) seen.add(key);
  }
  const merged = [...existing];
  for (const edge of incoming) {
    const key = edgeKey(edge);
    if (!key) {
      merged.push(edge);
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(edge);
    }
  }
  return merged;
}

export function countNewFollowEdges(existing: FollowEdge[], incoming: FollowEdge[]): number {
  if (incoming.length === 0) return 0;
  const seen = new Set<string>();
  for (const edge of existing) {
    const key = edgeKey(edge);
    if (key) seen.add(key);
  }
  let added = 0;
  for (const edge of incoming) {
    const key = edgeKey(edge);
    if (!key) {
      added += 1;
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      added += 1;
    }
  }
  return added;
}

export function shouldStopFollowPagination(args: {
  previousCursor: string | null;
  nextCursor: string | null;
  incomingCount: number;
  newlyAddedCount: number;
  repeatedPage?: boolean;
  totalCount?: number;
  loadedCount?: number;
}): boolean {
  if (args.incomingCount === 0) return true;
  if (!args.nextCursor) return true;
  if (args.repeatedPage) return true;
  if (args.previousCursor && args.previousCursor === args.nextCursor) return true;
  if (args.previousCursor && args.newlyAddedCount === 0) return true;
  if ((args.totalCount || 0) > 0 && (args.loadedCount || 0) >= (args.totalCount || 0)) return true;
  return false;
}

export function fingerprintFollowEdges(items: FollowEdge[]): string {
  if (items.length === 0) return '[]';
  return items.map((edge) => edgeKey(edge) || 'unknown').join('|');
}
