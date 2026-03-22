import { LINK_CONFIG, type LinkContextConfig, type LinkMode } from '../config';

export interface ResolvedLink {
  href: string;
  target: '_self' | '_blank';
  rel?: string;
  isExternal: boolean;
}

function renderPattern(pattern: string, params: Record<string, string | number>): string {
  return pattern.replace(/\{([^}]+)\}/g, (_match, rawKey: string) => {
    const key = rawKey.trim();
    const value = params[key];
    if (value === undefined || value === null) return '';
    return encodeURIComponent(String(value));
  });
}

function isExternalMode(mode: LinkMode): boolean {
  return mode === 'legacy' || mode === 'external';
}

function resolveTarget(context: LinkContextConfig): '_self' | '_blank' {
  if (context.target) return context.target;
  if (isExternalMode(context.mode)) {
    return LINK_CONFIG.defaults?.externalTarget || '_blank';
  }
  return LINK_CONFIG.defaults?.internalTarget || '_self';
}

export function resolveLink(contextId: string, params: Record<string, string | number> = {}): ResolvedLink {
  const context = LINK_CONFIG.contexts?.[contextId];
  if (!context) {
    throw new Error(`Unknown link context: ${contextId}`);
  }

  const href = renderPattern(context.pattern, params);
  const target = resolveTarget(context);
  const isExternal = isExternalMode(context.mode);
  const relTokens = context.rel || (isExternal ? LINK_CONFIG.defaults?.externalRel : undefined) || [];

  return {
    href,
    target,
    rel: relTokens.length > 0 ? relTokens.join(' ') : undefined,
    isExternal,
  };
}
