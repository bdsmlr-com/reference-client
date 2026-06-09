export type TransportScope = 'api' | 'auth' | 'recs';

export type TransportEnv = {
  VITE_API_BASE_URL?: string;
};

export type TransportContext = {
  hostname: string;
  hasAuthUser: boolean;
  env?: TransportEnv;
};

const DEFAULT_PRIVATE_API_BASE = '/v2/api';
const DEFAULT_ANONYMOUS_APEX_API_BASE = 'https://api-prod.bdsmlr.com/v2/api';

function normalizeBase(base: string): string {
  return base.replace(/\/$/, '');
}

function isApexHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'bdsmlr.com' || normalized === 'www.bdsmlr.com';
}

export function isAnonymousApexRuntime(context: TransportContext): boolean {
  return isApexHost(context.hostname) && !context.hasAuthUser;
}

function resolvePrivateBase(env: TransportEnv | undefined): string {
  return normalizeBase(env?.VITE_API_BASE_URL || DEFAULT_PRIVATE_API_BASE);
}

function resolveAnonymousApexBase(): string {
  // Anonymous browser reads on apex must always go directly to api-prod.
  // This must not be altered by per-service or per-build env overrides.
  return DEFAULT_ANONYMOUS_APEX_API_BASE;
}

export function resolveTransportBase(scope: TransportScope, context: TransportContext): string {
  if (isAnonymousApexRuntime(context)) {
    const publicBase = resolveAnonymousApexBase();
    switch (scope) {
      case 'auth':
        return `${publicBase}/auth`;
      case 'recs':
        return `${publicBase}/recs`;
      case 'api':
      default:
        return publicBase;
    }
  }

  const privateBase = resolvePrivateBase(context.env);
  switch (scope) {
    case 'auth':
      return `${privateBase}/auth`;
    case 'recs':
      return `${privateBase}/recs`;
    case 'api':
    default:
      return privateBase;
  }
}
