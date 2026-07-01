import mediaConfig from '../media-config.json';
import { trackOutageEvent } from './services/google-analytics.js';

/**
 * Global application configuration.
 */

export type ImgproxyMode = 'unsafe' | 'fixed';
export type LinkMode = 'internal' | 'legacy' | 'external';
export type MediaSurface = 'card' | 'masonry' | 'detail' | 'poster' | 'gallery-grid' | 'gallery-masonry' | 'feed' | 'lightbox' | 'post-detail' | 'gutter';
export type MediaSurfaceFormat = 'raw' | MediaSurface;

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
  media_format_by_surface?: Partial<Record<MediaSurface, MediaSurfaceFormat>>;
  /** When true, GIF/WebP may be used as video poster frames (loads animated bytes alongside MP4). */
  use_gif_posters?: boolean;
}

export interface RuntimeConfigPayload {
  features?: FeatureFlagsConfig;
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

function cloneFeatureFlagsConfig(source: FeatureFlagsConfig): FeatureFlagsConfig {
  return {
    ...source,
    media_format_by_surface: { ...(source.media_format_by_surface || {}) },
  };
}

function sanitizeSurfaceFormat(value: unknown): MediaSurfaceFormat | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  const allowed = new Set<MediaSurfaceFormat>(['raw', 'card', 'masonry', 'detail', 'poster', 'gallery-grid', 'gallery-masonry', 'feed', 'lightbox', 'post-detail', 'gutter']);
  return allowed.has(normalized as MediaSurfaceFormat) ? (normalized as MediaSurfaceFormat) : undefined;
}

const DEFAULT_FEATURE_FLAGS: FeatureFlagsConfig = cloneFeatureFlagsConfig(((mediaConfig as any).features || {}) as FeatureFlagsConfig);

export const FEATURE_FLAGS: FeatureFlagsConfig = cloneFeatureFlagsConfig(DEFAULT_FEATURE_FLAGS);

/** Bandwidth: animated posters fetch GIF/WebP in addition to MP4 on video surfaces. Off by default. */
export function useGifPosters(): boolean {
  return FEATURE_FLAGS.use_gif_posters === true;
}

let runtimeConfigLoaded = false;
let runtimeConfigPromise: Promise<void> | null = null;

function applyRuntimeFeatureFlags(override: FeatureFlagsConfig | undefined): void {
  if (!override || typeof override !== 'object') return;

  if (typeof override.more_like_this_on_post === 'boolean') {
    FEATURE_FLAGS.more_like_this_on_post = override.more_like_this_on_post;
  }
  if (typeof override.use_gif_posters === 'boolean') {
    FEATURE_FLAGS.use_gif_posters = override.use_gif_posters;
  }
  if (override.media_format_by_surface && typeof override.media_format_by_surface === 'object') {
    const merged = { ...(FEATURE_FLAGS.media_format_by_surface || {}) } as Partial<Record<MediaSurface, MediaSurfaceFormat>>;
    for (const [surface, value] of Object.entries(override.media_format_by_surface)) {
      const normalized = sanitizeSurfaceFormat(value);
      if (!normalized) continue;
      merged[surface as MediaSurface] = normalized;
    }
    FEATURE_FLAGS.media_format_by_surface = merged;
  }
}

export function applyRuntimeConfig(payload: RuntimeConfigPayload | null | undefined): void {
  if (!payload || typeof payload !== 'object') return;
  applyRuntimeFeatureFlags(payload.features);
}

export async function ensureRuntimeConfigLoaded(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (runtimeConfigLoaded) return;
  if (runtimeConfigPromise) return runtimeConfigPromise;
  runtimeConfigPromise = (async () => {
    try {
      const response = await fetchImpl('/v2/runtime-config', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (response.ok) {
        const payload = (await response.json()) as RuntimeConfigPayload;
        applyRuntimeConfig(payload);
      } else {
        trackOutageEvent('outage_runtime_config_load_failed', {
          component: 'runtime-config',
          context: `http_${response.status}`,
        });
      }
    } catch (error) {
      console.warn('Failed to load runtime config, using defaults', error);
      trackOutageEvent('outage_runtime_config_load_failed', {
        component: 'runtime-config',
        context: 'network_or_parse',
      });
    } finally {
      runtimeConfigLoaded = true;
      runtimeConfigPromise = null;
    }
  })();
  return runtimeConfigPromise;
}

export function resetRuntimeConfigForTests(): void {
  FEATURE_FLAGS.more_like_this_on_post = DEFAULT_FEATURE_FLAGS.more_like_this_on_post;
  FEATURE_FLAGS.use_gif_posters = DEFAULT_FEATURE_FLAGS.use_gif_posters;
  FEATURE_FLAGS.media_format_by_surface = { ...(DEFAULT_FEATURE_FLAGS.media_format_by_surface || {}) };
  runtimeConfigLoaded = false;
  runtimeConfigPromise = null;
}

// Build/runtime environment selection with safe fallback.
export const ACTIVE_ENV = ((import.meta as any).env?.VITE_BUILD_ENV || 'staging') as string;

export const CONFIG = ENV_CONFIGS[ACTIVE_ENV] || ENV_CONFIGS.staging || ENV_CONFIGS.dev;
