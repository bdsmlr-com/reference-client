import { getAuthUser } from '../state/auth-state.js';

function normalizeCapability(value: string | null | undefined): string {
  return `${value || ''}`.trim();
}

export function getViewerCapabilities(): string[] {
  const capabilities = getAuthUser()?.capabilities || [];
  return capabilities.map(normalizeCapability).filter(Boolean);
}

export function viewerHasCapability(capability: string): boolean {
  const normalized = normalizeCapability(capability);
  if (!normalized) {
    return false;
  }
  return getViewerCapabilities().includes(normalized);
}
