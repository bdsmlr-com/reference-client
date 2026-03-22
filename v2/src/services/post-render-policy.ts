import {
  ACTIVE_ENV,
  POST_RENDER_POLICY_CONFIG,
  type PostRenderPolicy,
} from '../config';

export interface ResolvePolicyContext {
  view?: string;
  role?: string;
  env?: string;
}

function mergePolicy(...policies: Array<PostRenderPolicy | undefined>): PostRenderPolicy {
  const merged: PostRenderPolicy = {};
  for (const policy of policies) {
    if (!policy) continue;
    Object.assign(merged, policy);
  }
  return merged;
}

export function resolvePostRenderPolicy(ctx: ResolvePolicyContext = {}): PostRenderPolicy {
  const viewPolicy = ctx.view ? POST_RENDER_POLICY_CONFIG.by_view?.[ctx.view] : undefined;
  const rolePolicy = ctx.role ? POST_RENDER_POLICY_CONFIG.by_role?.[ctx.role] : undefined;
  const envKey = ctx.env || ACTIVE_ENV;
  const envPolicy = envKey ? POST_RENDER_POLICY_CONFIG.by_env?.[envKey] : undefined;

  return mergePolicy(
    POST_RENDER_POLICY_CONFIG.base,
    viewPolicy,
    rolePolicy,
    envPolicy,
  );
}
