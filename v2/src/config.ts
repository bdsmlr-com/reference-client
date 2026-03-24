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
  icon?: string;
  labelTemplate?: string;
  titleTemplate?: string;
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

export type RenderLayout = 'grid' | 'masonry' | 'full' | 'cluster' | 'lightbox' | 'list';
export type RenderSkeletonTransition = 'swap' | 'crossfade' | 'stagger';

export interface RenderSlotLoadingConfig {
  cardType: string;
  count: number;
}

export interface RenderSlotConfig {
  cards: string[];
  async?: boolean;
  loading?: RenderSlotLoadingConfig;
}

export interface RenderPageConfig {
  slots: Record<string, RenderSlotConfig>;
}

export interface RenderSkeletonConfig {
  variant: string;
  structure: string[];
  count_policy: { default: number };
  transition: RenderSkeletonTransition;
}

export interface RenderCardConfig {
  layout: RenderLayout;
  elements: string[];
  regions?: Partial<Record<'header' | 'media' | 'meta' | 'badges' | 'actions', string[]>>;
  mode_overrides?: Record<'regular' | 'admin', { region_order?: Array<'header' | 'media' | 'meta' | 'badges' | 'actions'> }>;
  skeleton?: RenderSkeletonConfig;
}

export interface RenderElementConfig {
  primitive?: string;
  visibility_rules?: {
    modes?: Array<'regular' | 'admin'>;
    requires_admin?: boolean;
  };
}

export interface RenderInteractionConfig {
  type?: 'open_lightbox' | 'navigate' | 'emit_event' | 'toggle';
  linkContext?: string;
  eventName?: string;
  stopPropagation?: boolean;
  preventDefault?: boolean;
  zone?: 'media' | 'metadata' | 'permalink' | 'tag_chip' | 'card_surface' | 'action';
}

export interface RenderContractConfig {
  pages: Record<string, RenderPageConfig>;
  cards: Record<string, RenderCardConfig>;
  elements: Record<string, RenderElementConfig>;
  interactions: Record<string, RenderInteractionConfig>;
}

export const MEDIA_PRESETS: Record<string, MediaPreset> = mediaConfig.presets as Record<string, MediaPreset>;

export const ENV_CONFIGS: Record<string, AppConfig> = mediaConfig.environments as Record<string, AppConfig>;
export const LINK_CONFIG: LinkConfig = (mediaConfig as any).links as LinkConfig;
export const POST_RENDER_POLICY_CONFIG: PostRenderPolicyConfig = (mediaConfig as any).post_render_policy as PostRenderPolicyConfig;
export const RENDER_CONTRACT_CONFIG: RenderContractConfig = (mediaConfig as any).render as RenderContractConfig;

// CURRENT ACTIVE ENVIRONMENT
export const ACTIVE_ENV = 'staging';

export const CONFIG = ENV_CONFIGS[ACTIVE_ENV];
