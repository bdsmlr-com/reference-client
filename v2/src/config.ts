/**
 * Global application configuration.
 */

export type ImgproxyMode = 'unsafe' | 'fixed';

export interface AppConfig {
  name: string;
  mediaProxyBase: string;
  imgproxyMode: ImgproxyMode;
  defaultGravity: string;
}

export const ENV_CONFIGS: Record<string, AppConfig> = {
  dev: {
    name: 'Development',
    mediaProxyBase: 'http://100.98.53.103:8085/unsafe',
    imgproxyMode: 'unsafe',
    defaultGravity: 'gravity:sm'
  },
  staging: {
    name: 'Staging',
    mediaProxyBase: 'http://100.98.53.103:8085/unsafe',
    imgproxyMode: 'unsafe',
    defaultGravity: 'gravity:sm'
  },
  prod: {
    name: 'Production',
    mediaProxyBase: 'https://media.bdsmlr.com', // Future fixed path host
    imgproxyMode: 'fixed',
    defaultGravity: 'gravity:sm'
  }
};

// CURRENT ACTIVE ENVIRONMENT
export const ACTIVE_ENV = 'staging';

export const CONFIG = ENV_CONFIGS[ACTIVE_ENV];
