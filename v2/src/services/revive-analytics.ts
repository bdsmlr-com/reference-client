import { testTrackEvent } from './google-analytics.js';

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
let blockedTracked = false;
let pendingSpc: PendingSpc | null = null;
let sdkWatchTimer: ReturnType<typeof setTimeout> | null = null;
let scriptObserver: MutationObserver | null = null;

function clearPendingSpc(): void {
  if (!pendingSpc) return;
  clearTimeout(pendingSpc.timer);
  pendingSpc = null;
}

function trackSdkLoaded(reason: string): void {
  if (sdkLoadedTracked) return;
  sdkLoadedTracked = true;
  if (sdkWatchTimer) {
    clearTimeout(sdkWatchTimer);
    sdkWatchTimer = null;
  }
  testTrackEvent('ad_sdk_loaded', { reason, revive_id: REVIVE_ACCOUNT_ID });
}

/**
 * Heuristic: zone responded but served nothing billable / visible.
 * Refine once ad-ops confirm the empty DOM signature.
 */
function isEmptyCreative(data: ReviveCreativeData | undefined): boolean {
  if (!data) return true;
  const html = String(data.html ?? '').trim();
  if (!html) return true;
  if (/^\s*(<!--[\s\S]*?-->\s*)*$/.test(html)) return true;

  const width = Number(data.width) || 0;
  const height = Number(data.height) || 0;
  // Revive often returns 0×0 with negligible markup for no-fill.
  if (width === 0 && height === 0 && html.length < 80) return true;

  return false;
}

function slotParams(slotId: string, data?: ReviveCreativeData): Record<string, unknown> {
  const el = typeof document !== 'undefined' ? document.getElementById(slotId) : null;
  return {
    revive_id: REVIVE_ACCOUNT_ID,
    slot_id: slotId,
    zone_id: el?.getAttribute('data-revive-zoneid') ?? undefined,
    width: data?.width,
    height: data?.height,
    iframe_friendly: data?.iframeFriendly,
    html_length: String(data?.html ?? '').length,
  };
}

function trackBlocked(reason: string, extra?: Record<string, unknown>): void {
  if (blockedTracked) return;
  blockedTracked = true;
  testTrackEvent('ad_blocked_detected', {
    reason,
    revive_id: REVIVE_ACCOUNT_ID,
    ...extra,
  });
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
      trackSdkLoaded('script_load');
    },
    { once: true }
  );

  script.addEventListener(
    'error',
    () => {
      testTrackEvent('ad_load_failed', {
        reason: 'sdk_script_error',
        revive_id: REVIVE_ACCOUNT_ID,
        script_src: script.src || undefined,
      });
      trackBlocked('sdk_script_error', { script_src: script.src || undefined });
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
      trackSdkLoaded('late_detect');
      return;
    }

    testTrackEvent('ad_load_failed', {
      reason: 'sdk_never_loaded',
      revive_id: REVIVE_ACCOUNT_ID,
      slot_count: slots.length,
    });
    trackBlocked('sdk_never_loaded', { slot_count: slots.length });
  }, SDK_ABSENCE_MS);
}

function onSend(event: Event): void {
  const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
  const zones = detail.zones;
  const zoneCount =
    typeof zones === 'string'
      ? zones.split('|').filter(Boolean).length
      : Array.isArray(zones)
        ? zones.filter(Boolean).length
        : 0;

  testTrackEvent('ad_request', {
    revive_id: REVIVE_ACCOUNT_ID,
    zone_count: zoneCount,
    zones: typeof zones === 'string' ? zones : undefined,
  });

  clearPendingSpc();
  pendingSpc = {
    zoneCount,
    timer: setTimeout(() => {
      pendingSpc = null;
      testTrackEvent('ad_load_failed', {
        reason: 'spc_timeout',
        revive_id: REVIVE_ACCOUNT_ID,
        zone_count: zoneCount,
        timeout_ms: SPC_TIMEOUT_MS,
      });
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
  const params = slotParams(slotId, data);

  if (isEmptyCreative(data)) {
    testTrackEvent('ad_empty_impression', params);
    return;
  }

  testTrackEvent('ad_impression', params);

  // Cosmetic blockers sometimes leave markup but collapse/hide the slot.
  queueMicrotask(() => {
    const el = slotId ? document.getElementById(slotId) : null;
    if (!el || isIntentionallySuppressedBanner(el)) return;
    if (isSlotCosmeticallyHidden(el)) {
      trackBlocked('slot_hidden_after_fill', {
        slot_id: slotId,
        zone_id: params.zone_id,
      });
    }
  });
}

/**
 * Subscribe to Revive asyncjs CustomEvents and emit test GA events.
 * Safe to call more than once. Does not send to GA until testTrackEvent → trackEvent swap.
 */
export function initReviveAnalytics(): void {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  initialized = true;

  document.addEventListener(`${EVENT_PREFIX}init`, () => {
    trackSdkLoaded('init_event');
  });
  document.addEventListener(`${EVENT_PREFIX}send`, onSend);
  document.addEventListener(`${EVENT_PREFIX}receive`, onReceive);
  document.addEventListener(`${EVENT_PREFIX}loaded`, onLoaded);

  // Interstitial (classic script) can dispatch this if script.onerror fires first.
  document.addEventListener('revive-sdk-load-failed', ((event: Event) => {
    const detail = (event as CustomEvent<{ script_src?: string }>).detail || {};
    testTrackEvent('ad_load_failed', {
      reason: 'sdk_script_error',
      revive_id: REVIVE_ACCOUNT_ID,
      script_src: detail.script_src,
    });
    trackBlocked('sdk_script_error', { script_src: detail.script_src });
  }) as EventListener);

  observeAsyncjsScripts();

  const reviveAsync = (globalThis as { reviveAsync?: Record<string, unknown> }).reviveAsync;
  if (reviveAsync?.[REVIVE_ACCOUNT_ID]) {
    trackSdkLoaded('already_present');
  } else {
    scheduleSdkAbsenceWatch();
  }
}
