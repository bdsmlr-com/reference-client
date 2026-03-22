import mediaConfig from '../media-config.json';

/**
 * Global application configuration.
 */

export type ImgproxyMode = 'unsafe' | 'fixed';
export type LinkMode = 'internal' | 'legacy' | 'external';

export interface MediaPreset {
  width: number;
  height: number;
  gravity: string;
  resize: 'fill' | 'fit';
  format?: 'webp' | 'mp4' | 'jpg';
}

export interface AppConfig {
  name: string;
  mediaProxyBase: string;
  imgproxyMode: ImgproxyMode;
}

export interface LinkContextConfig {
  mode: LinkMode;
  pattern: string;
  target?: '_self' | '_blank';
  rel?: string[];
  track?: string;
}

export interface LinkDefaultsConfig {
  internalTarget?: '_self' | '_blank';
  externalTarget?: '_self' | '_blank';
  externalRel?: string[];
}

export interface LinkConfig {
  defaults?: LinkDefaultsConfig;
  contexts: Record<string, LinkContextConfig>;
}

export interface PostRenderPolicy {
  showPermalink?: boolean;
  showBlogChip?: boolean;
  compactMetadata?: boolean;
}

export interface PostRenderPolicyConfig {
  base: PostRenderPolicy;
  by_view?: Record<string, PostRenderPolicy>;
  by_role?: Record<string, PostRenderPolicy>;
  by_env?: Record<string, PostRenderPolicy>;
}

export const MEDIA_PRESETS: Record<string, MediaPreset> = mediaConfig.presets as Record<string, MediaPreset>;

export const ENV_CONFIGS: Record<string, AppConfig> = mediaConfig.environments as Record<string, AppConfig>;
export const LINK_CONFIG: LinkConfig = (mediaConfig as any).links as LinkConfig;
export const POST_RENDER_POLICY_CONFIG: PostRenderPolicyConfig = (mediaConfig as any).post_render_policy as PostRenderPolicyConfig;

// CURRENT ACTIVE ENVIRONMENT
export const ACTIVE_ENV = 'staging';

export const CONFIG = ENV_CONFIGS[ACTIVE_ENV];
