import type { FollowEdge } from '../types/api';

export function mergeFollowEdges(existing: FollowEdge[], incoming: FollowEdge[]): FollowEdge[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((edge) => edge.blogId));
  const merged = [...existing];
  for (const edge of incoming) {
    if (!seen.has(edge.blogId)) {
      seen.add(edge.blogId);
      merged.push(edge);
    }
  }
  return merged;
}

export function countNewFollowEdges(existing: FollowEdge[], incoming: FollowEdge[]): number {
  if (incoming.length === 0) return 0;
  const seen = new Set(existing.map((edge) => edge.blogId));
  let added = 0;
  for (const edge of incoming) {
    if (!seen.has(edge.blogId)) {
      seen.add(edge.blogId);
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
}): boolean {
  if (args.incomingCount === 0) return true;
  if (!args.nextCursor) return true;
  if (args.previousCursor && args.previousCursor === args.nextCursor) return true;
  if (args.previousCursor && args.newlyAddedCount === 0) return true;
  return false;
}
