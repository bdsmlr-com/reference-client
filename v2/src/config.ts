import mediaConfig from '../media-config.json';

/**
 * Global application configuration.
 */

export type ImgproxyMode = 'unsafe' | 'fixed';

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

export const MEDIA_PRESETS: Record<string, MediaPreset> = mediaConfig.presets as Record<string, MediaPreset>;

export const ENV_CONFIGS: Record<string, AppConfig> = mediaConfig.environments as Record<string, AppConfig>;

// CURRENT ACTIVE ENVIRONMENT
export const ACTIVE_ENV = 'staging';

export const CONFIG = ENV_CONFIGS[ACTIVE_ENV];
