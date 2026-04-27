import type { ProcessedPost } from '../types/post.js';

export type RetrievalPostPolicy = {
  imageVariant?: string;
  linkAllowed?: boolean;
  clickAction?: string;
  redactionMode?: string;
  overrideReason?: string;
  visibilityFraction?: number;
};

export type RetrievalPostPolicyMap = Record<string, RetrievalPostPolicy | undefined>;
export type RetrievalClickMode = 'navigate' | 'open_modal' | 'disabled';

export function getRetrievalPostPolicy(
  postId: number,
  policies: RetrievalPostPolicyMap | undefined,
): RetrievalPostPolicy | undefined {
  return policies?.[String(postId)];
}

export function applyRetrievalPostPolicies(
  posts: ProcessedPost[],
  policies: RetrievalPostPolicyMap | undefined,
): ProcessedPost[] {
  if (!policies || posts.length === 0) {
    return posts;
  }

  return posts.map((post) => {
    const policy = getRetrievalPostPolicy(post.id, policies);
    if (!policy) {
      return post;
    }

    return {
      ...post,
      _retrievalPolicy: policy,
    } as ProcessedPost;
  });
}

export function resolveRetrievalClickMode(policy: RetrievalPostPolicy | undefined): RetrievalClickMode {
  if (!policy) {
    return 'navigate';
  }
  if (policy.clickAction === 'open_modal') {
    return 'open_modal';
  }
  if (policy.linkAllowed === false) {
    return 'open_modal';
  }
  if (policy.linkAllowed === true) {
    return 'navigate';
  }
  return 'navigate';
}
