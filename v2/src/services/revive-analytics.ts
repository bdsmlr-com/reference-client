import { trackEvent } from './google-analytics.js';

/** Hosted Revive account id used by interstitial (and any other async tags on the page). */
export const REVIVE_ACCOUNT_ID = '727bec5e09208690b050ccfc6a45d384';

const EVENT_PREFIX = `revive-${REVIVE_ACCOUNT_ID}-`;
const SPC_TIMEOUT_MS = 8_000;
const SDK_ABSENCE_MS = 10_000;

type ReviveCreativeData = {
  html?: string;
  width?: number;
  height?: number;
  iframeFriendly?: boolean;
  [key: string]: unknown;
};

type PendingSpc = {
  timer: ReturnType<typeof setTimeout>;
  zoneCount: number;
};

let initialized = false;
let sdkLoadedTracked = false;
let sdkFailedTracked = false;
let pendingSpc: PendingSpc | null = null;
let sdkWatchTimer: ReturnType<typeof setTimeout> | null = null;
let scriptObserver: MutationObserver | null = null;

function clearPendingSpc(): void {
  if (!pendingSpc) return;
  clearTimeout(pendingSpc.timer);
  pendingSpc = null;
}

function markSdkLoaded(): void {
  if (sdkLoadedTracked || sdkFailedTracked) return;
  sdkLoadedTracked = true;
  if (sdkWatchTimer) {
    clearTimeout(sdkWatchTimer);
    sdkWatchTimer = null;
  }
  // Optional: enable if we want an explicit success signal. Usually implied by
  // absence of ad_sdk_blocked / ad_load_failed.
  // trackEvent('ad_sdk_loaded', { revive_id: REVIVE_ACCOUNT_ID });
}

/**
 * SDK failed to load (script error / never present) — treat as ad blocker.
 * One shot; overlapping detectors share this. Does not emit ad_load_failed
 * (that is reserved for zone/SPC request failures after the SDK is up).
 */
function trackSdkBlocked(reason: string, extra?: Record<string, unknown>): void {
  if (sdkFailedTracked || sdkLoadedTracked) return;
  sdkFailedTracked = true;
  if (sdkWatchTimer) {
    clearTimeout(sdkWatchTimer);
    sdkWatchTimer = null;
  }
  trackEvent('ad_sdk_blocked', {
    reason,
    revive_id: REVIVE_ACCOUNT_ID,
    ...extra,
  });
}

/**
 * Field signature for "zone OK, no inventory assigned":
 * a single hidden beacon div with a 0×0 lg.php img (bannerid=0).
 * Scoped to the slot so we don't match unrelated banners.
 */
function isEmptyInventorySlot(el: Element | null): boolean {
  if (!el || el.getAttribute('data-revive-loaded') !== '1') return false;
  return Boolean(el.querySelector(':scope > div:only-child > img:only-child'));
}

function slotParams(slotId: string, data?: ReviveCreativeData): Record<string, unknown> {
  const el = typeof document !== 'undefined' ? document.getElementById(slotId) : null;
  return {
    revive_id: REVIVE_ACCOUNT_ID,
    zone_id: el?.getAttribute('data-revive-zoneid') ?? undefined,
    width: data?.width,
    height: data?.height,
    iframe_friendly: data?.iframeFriendly,
    html_length: String(data?.html ?? '').length,
  };
}

function isSlotCosmeticallyHidden(el: Element | null): boolean {
  if (!el || typeof getComputedStyle === 'undefined') return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return true;
  }
  const rect = el.getBoundingClientRect();
  return rect.width === 0 || rect.height === 0;
}

/**
 * True when our own interstitial CSS is intentionally hiding non-overlay banners.
 */
function isIntentionallySuppressedBanner(el: Element | null): boolean {
  if (!el || typeof document === 'undefined') return false;
  if (!document.body?.hasAttribute('with-interstitial')) return false;
  // Overlay slot is the one we want; siblings under body are hidden on purpose.
  return !el.closest('overbearing-overlay');
}

function bindAsyncjsScript(script: HTMLScriptElement): void {
  if (script.dataset.reviveAnalyticsBound === '1') return;
  script.dataset.reviveAnalyticsBound = '1';

  script.addEventListener(
    'load',
    () => {
      markSdkLoaded();
    },
    { once: true }
  );

  script.addEventListener(
    'error',
    () => {
      trackSdkBlocked('sdk_script_error', { script_src: script.src || undefined });
    },
    { once: true }
  );
}

function observeAsyncjsScripts(): void {
  if (typeof document === 'undefined') return;

  document
    .querySelectorAll<HTMLScriptElement>('script[src*="asyncjs.php"]')
    .forEach(bindAsyncjsScript);

  if (scriptObserver || typeof MutationObserver === 'undefined') return;

  scriptObserver = new MutationObserver((mutations) => {
    let sawReviveSlot = false;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLScriptElement) {
          const src = node.getAttribute('src') || '';
          if (src.includes('asyncjs.php')) {
            bindAsyncjsScript(node);
          }
        }

        if (node instanceof Element) {
          if (
            node.matches?.(`ins[data-revive-id="${REVIVE_ACCOUNT_ID}"]`) ||
            node.querySelector?.(`ins[data-revive-id="${REVIVE_ACCOUNT_ID}"]`)
          ) {
            sawReviveSlot = true;
          }
        }
      }
    }

    if (sawReviveSlot && !sdkLoadedTracked) {
      scheduleSdkAbsenceWatch();
    }
  });

  scriptObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function scheduleSdkAbsenceWatch(): void {
  if (sdkWatchTimer || sdkLoadedTracked) return;

  sdkWatchTimer = setTimeout(() => {
    sdkWatchTimer = null;
    if (sdkLoadedTracked) return;

    const slots =
      typeof document !== 'undefined'
        ? document.querySelectorAll(`ins[data-revive-id="${REVIVE_ACCOUNT_ID}"]`)
        : [];

    if (!slots.length) return;

    const reviveAsync = (globalThis as { reviveAsync?: Record<string, unknown> }).reviveAsync;
    if (reviveAsync?.[REVIVE_ACCOUNT_ID]) {
      markSdkLoaded();
      return;
    }

    trackSdkBlocked('sdk_never_loaded', { slot_count: slots.length });
  }, SDK_ABSENCE_MS);
}

function onSend(event: Event): void {
  const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
  const zones = detail.zones;
  const zoneIds =
    typeof zones === 'string'
      ? zones.split('|').filter(Boolean)
      : Array.isArray(zones)
        ? zones.map(String).filter(Boolean)
        : [];

  // Optional: enable if we want request volume. Usually implied by impressions /
  // empty_inventory / load_failed downstream.
  // trackEvent('ad_request', {
  //   revive_id: REVIVE_ACCOUNT_ID,
  //   zone_count: zoneIds.length,
  //   zones: zoneIds.join('|') || undefined,
  // });

  clearPendingSpc();
  pendingSpc = {
    zoneCount: zoneIds.length,
    timer: setTimeout(() => {
      pendingSpc = null;
      // One event per zone so GA counts stay 1:1 with slots (and future
      // per-zone failure reasons can share this shape).
      for (const zoneId of zoneIds) {
        trackEvent('ad_load_failed', {
          reason: 'spc_timeout',
          revive_id: REVIVE_ACCOUNT_ID,
          zone_id: zoneId,
          timeout_ms: SPC_TIMEOUT_MS,
        });
      }
    }, SPC_TIMEOUT_MS),
  };
}

function onReceive(): void {
  clearPendingSpc();
}

function onLoaded(event: Event): void {
  const detail = (event as CustomEvent<{ id?: string; data?: ReviveCreativeData }>).detail || {};
  const slotId = String(detail.id || '');
  const data = detail.data;
  const el = slotId ? document.getElementById(slotId) : null;
  const params = slotParams(slotId, data);

  if (isEmptyInventorySlot(el)) {
    trackEvent('ad_empty_inventory', params);
    return;
  }

  trackEvent('ad_impression', params);

  // Cosmetic blockers sometimes leave markup but collapse/hide the slot.
  queueMicrotask(() => {
    if (!el || isIntentionallySuppressedBanner(el)) return;
    if (isSlotCosmeticallyHidden(el)) {
      trackEvent('ad_zone_blocked', {
        reason: 'slot_hidden_after_fill',
        ...params,
      });
    }
  });
}

/**
 * Subscribe to Revive asyncjs CustomEvents and emit GA4 ad events.
 * Safe to call more than once.
 */
export function initReviveAnalytics(): void {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  initialized = true;

  document.addEventListener(`${EVENT_PREFIX}init`, () => {
    markSdkLoaded();
  });
  document.addEventListener(`${EVENT_PREFIX}send`, onSend);
  document.addEventListener(`${EVENT_PREFIX}receive`, onReceive);
  document.addEventListener(`${EVENT_PREFIX}loaded`, onLoaded);

  // Interstitial (classic script) can dispatch this if script.onerror fires first.
  document.addEventListener('revive-sdk-load-failed', ((event: Event) => {
    const detail = (event as CustomEvent<{ script_src?: string }>).detail || {};
    trackSdkBlocked('sdk_script_error', { script_src: detail.script_src });
  }) as EventListener);

  observeAsyncjsScripts();

  const reviveAsync = (globalThis as { reviveAsync?: Record<string, unknown> }).reviveAsync;
  if (reviveAsync?.[REVIVE_ACCOUNT_ID]) {
    markSdkLoaded();
  } else {
    scheduleSdkAbsenceWatch();
  }
}
