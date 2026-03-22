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

export const MEDIA_PRESETS: Record<string, MediaPreset> = mediaConfig.presets as Record<string, MediaPreset>;

export const ENV_CONFIGS: Record<string, AppConfig> = mediaConfig.environments as Record<string, AppConfig>;
export const LINK_CONFIG: LinkConfig = (mediaConfig as any).links as LinkConfig;

// CURRENT ACTIVE ENVIRONMENT
export const ACTIVE_ENV = 'staging';

export const CONFIG = ENV_CONFIGS[ACTIVE_ENV];
