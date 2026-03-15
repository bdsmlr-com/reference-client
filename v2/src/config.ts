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

export const MEDIA_PRESETS: Record<string, MediaPreset> = {
  'gallery-grid': {
    width: 300,
    height: 300,
    gravity: 'gravity:sm',
    resize: 'fill'
  },
  'gallery-masonry': {
    width: 400,
    height: 0,
    gravity: 'gravity:sm',
    resize: 'fit'
  },
  'feed': {
    width: 600,
    height: 0,
    gravity: 'gravity:sm',
    resize: 'fit'
  },
  'lightbox': {
    width: 1200,
    height: 0,
    gravity: 'gravity:sm',
    resize: 'fit'
  },
  'poster': {
    width: 600,
    height: 0,
    gravity: 'gravity:sm',
    resize: 'fit',
    format: 'jpg'
  },
  'gutter': {
    width: 150,
    height: 150,
    gravity: 'gravity:sm',
    resize: 'fill'
  }
};

export const ENV_CONFIGS: Record<string, AppConfig> = {
  dev: {
    name: 'Development',
    mediaProxyBase: 'http://100.98.53.103:8085/unsafe',
    imgproxyMode: 'unsafe'
  },
  staging: {
    name: 'Staging',
    mediaProxyBase: 'http://100.98.53.103:8085/unsafe',
    imgproxyMode: 'unsafe'
  },
  prod: {
    name: 'Production',
    mediaProxyBase: 'https://media.bdsmlr.com',
    imgproxyMode: 'fixed'
  }
};

// CURRENT ACTIVE ENVIRONMENT
export const ACTIVE_ENV = 'staging';

export const CONFIG = ENV_CONFIGS[ACTIVE_ENV];
