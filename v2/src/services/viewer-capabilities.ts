import { getMe } from './auth-service.js';
import { getAuthUser, setAuthUser } from '../state/auth-state.js';

function normalizeCapability(value: string | null | undefined): string {
  return `${value || ''}`.trim();
}

function normalizeCapabilities(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((value) => normalizeCapability(typeof value === 'string' ? value : '')).filter(Boolean);
}

let resolvedUserId: number | null = null;
let resolvedCapabilities: string[] | null = null;
let inFlightUserId: number | null = null;
let inFlight: Promise<string[]> | null = null;

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

function rememberCapabilities(capabilities: string[]): void {
  const user = getAuthUser();
  if (!user) {
    return;
  }
  const current = user.capabilities || [];
  if (current.length === capabilities.length && current.every((cap, index) => cap === capabilities[index])) {
    return;
  }
  setAuthUser({
    ...user,
    capabilities,
  });
}

export async function ensureViewerCapabilities(): Promise<string[]> {
  const user = getAuthUser();
  if (!user) {
    resolvedUserId = null;
    resolvedCapabilities = null;
    inFlightUserId = null;
    inFlight = null;
    return [];
  }

  if (resolvedUserId === user.userId && resolvedCapabilities !== null) {
    return resolvedCapabilities;
  }

  if (inFlight && inFlightUserId === user.userId) {
    return inFlight;
  }

  const userId = user.userId;
  inFlightUserId = userId;
  inFlight = (async () => {
    try {
      const me = await getMe();
      const capabilities = normalizeCapabilities(me.capabilities);
      resolvedUserId = userId;
      resolvedCapabilities = capabilities;
      rememberCapabilities(capabilities);
      return capabilities;
    } catch {
      if (inFlightUserId === userId) {
        inFlight = null;
        inFlightUserId = null;
      }
      return [];
    }
  })();

  return inFlight;
}
