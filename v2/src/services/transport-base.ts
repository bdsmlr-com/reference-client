export type TransportScope = 'api' | 'auth' | 'recs';

export type TransportEnv = {
  VITE_API_BASE_URL?: string;
};

export type TransportContext = {
  hostname: string;
  hasAuthUser: boolean;
  env?: TransportEnv;
};

const DEFAULT_PRIVATE_API_BASE = ['','v2','api'].join('/');
const DEFAULT_APEX_API_BASE = 'https://api-prod.bdsmlr.com/v2/api';

function normalizeBase(base: string): string {
  return base.replace(/\/$/, '');
}

function isApexHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'bdsmlr.com' || normalized === 'www.bdsmlr.com';
}

export function isApexRuntime(context: TransportContext): boolean {
  return isApexHost(context.hostname);
}

function resolvePrivateBase(env: TransportEnv | undefined): string {
  return normalizeBase(env?.VITE_API_BASE_URL || DEFAULT_PRIVATE_API_BASE);
}

function resolveApexBase(): string {
  // Apex browsers must always hit api-prod directly for v2 runtime API traffic.
  return DEFAULT_APEX_API_BASE;
}

export function resolveTransportBase(scope: TransportScope, context: TransportContext): string {
  if (isApexRuntime(context)) {
    const apexBase = resolveApexBase();
    switch (scope) {
      case 'auth':
        return `${apexBase}/auth`;
      case 'recs':
        return `${apexBase}/recs`;
      case 'api':
      default:
        return apexBase;
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
