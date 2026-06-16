import mediaConfig from '../media-config.json';

/**
 * Global application configuration.
 */

export type ImgproxyMode = 'unsafe' | 'fixed';
export type LinkMode = 'internal' | 'legacy' | 'external';
export type MediaRawSurface = 'card' | 'masonry' | 'detail' | 'poster' | 'gallery-grid' | 'gallery-masonry' | 'feed' | 'lightbox' | 'post-detail' | 'gutter';

export interface MediaPreset {
  width: number;
  height: number;
  gravity: string;
  resize: 'fill' | 'fit';
  format?: 'webp' | 'mp4' | 'jpg';
}

export interface MediaBehavior {
  autoplay: boolean;
  controls: boolean;
  loop: boolean;
  preload?: 'none' | 'metadata' | 'auto';
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

export interface FeatureFlagsConfig {
  more_like_this_on_post?: boolean;
  reblog_composer?: boolean;
  media_raw_by_surface?: Partial<Record<MediaRawSurface, boolean>>;
}

export interface RenderContractConfig {
  pages: Record<string, RenderPageConfig>;
  cards: Record<string, RenderCardConfig>;
  elements: Record<string, RenderElementConfig>;
  interactions: Record<string, RenderInteractionConfig>;
}

export const MEDIA_PRESETS: Record<string, MediaPreset> = mediaConfig.presets as Record<string, MediaPreset>;
export const MEDIA_BEHAVIOR: Record<string, MediaBehavior> = (mediaConfig as any).media_behavior as Record<string, MediaBehavior>;

export const ENV_CONFIGS: Record<string, AppConfig> = mediaConfig.environments as Record<string, AppConfig>;
export const LINK_CONFIG: LinkConfig = (mediaConfig as any).links as LinkConfig;
export const POST_RENDER_POLICY_CONFIG: PostRenderPolicyConfig = (mediaConfig as any).post_render_policy as PostRenderPolicyConfig;
export const RENDER_CONTRACT_CONFIG: RenderContractConfig = (mediaConfig as any).render as RenderContractConfig;

const MEDIA_RAW_SURFACE_ENV_KEYS: Record<MediaRawSurface, string> = {
  card: 'VITE_MEDIA_RAW_CARD',
  masonry: 'VITE_MEDIA_RAW_MASONRY',
  detail: 'VITE_MEDIA_RAW_DETAIL',
  poster: 'VITE_MEDIA_RAW_POSTER',
  'gallery-grid': 'VITE_MEDIA_RAW_GALLERY_GRID',
  'gallery-masonry': 'VITE_MEDIA_RAW_GALLERY_MASONRY',
  feed: 'VITE_MEDIA_RAW_FEED',
  lightbox: 'VITE_MEDIA_RAW_LIGHTBOX',
  'post-detail': 'VITE_MEDIA_RAW_POST_DETAIL',
  gutter: 'VITE_MEDIA_RAW_GUTTER',
};

function parseBooleanEnvFlag(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function readEnvFlag(name: string): boolean | undefined {
  return parseBooleanEnvFlag((import.meta as any).env?.[name]);
}

function buildFeatureFlags(): FeatureFlagsConfig {
  const defaults = ((mediaConfig as any).features || {}) as FeatureFlagsConfig;
  const mediaRawDefaults = { ...(defaults.media_raw_by_surface || {}) } as Partial<Record<MediaRawSurface, boolean>>;

  for (const [surface, envKey] of Object.entries(MEDIA_RAW_SURFACE_ENV_KEYS)) {
    const override = readEnvFlag(envKey);
    if (override !== undefined) {
      mediaRawDefaults[surface as MediaRawSurface] = override;
    }
  }

  return {
    ...defaults,
    more_like_this_on_post: readEnvFlag('VITE_FF_MORE_LIKE_THIS_ON_POST') ?? defaults.more_like_this_on_post,
    reblog_composer: readEnvFlag('VITE_FF_REBLOG_COMPOSER') ?? defaults.reblog_composer,
    media_raw_by_surface: mediaRawDefaults,
  };
}

export const FEATURE_FLAGS: FeatureFlagsConfig = buildFeatureFlags();

// Build/runtime environment selection with safe fallback.
export const ACTIVE_ENV = ((import.meta as any).env?.VITE_BUILD_ENV || 'staging') as string;

export const CONFIG = ENV_CONFIGS[ACTIVE_ENV] || ENV_CONFIGS.staging || ENV_CONFIGS.dev;
