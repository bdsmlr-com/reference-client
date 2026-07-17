import type { ProcessedPost } from '../types/post.js';
import { ACTIVE_ENV } from '../config.js';

const BLUR_FACTOR_STORAGE_KEY = 'redaction-blur-factor';
const BLUR_FACTOR_CSS_VAR = '--redaction-blur-factor';

function clampBlurFactor(factor: number): number {
  if (!Number.isFinite(factor) || factor <= 0) return 1;
  return factor;
}

function readStoredBlurFactor(): number {
  try {
    const raw = localStorage.getItem(BLUR_FACTOR_STORAGE_KEY);
    if (raw == null || raw === '') return 1;
    return clampBlurFactor(Number(raw));
  } catch {
    return 1;
  }
}

function writeStoredBlurFactor(factor: number): void {
  try {
    localStorage.setItem(BLUR_FACTOR_STORAGE_KEY, String(factor));
  } catch {
    // Ignore private-mode / quota failures; live CSS var still applies.
  }
}

function applyBlurFactorToDocument(factor: number): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(BLUR_FACTOR_CSS_VAR, String(factor));
}

/** Current redaction blur multiplier (1 = base CSS blur). */
export function getRedactionBlurFactor(): number {
  if (typeof document === 'undefined') return readStoredBlurFactor();
  const raw = getComputedStyle(document.documentElement).getPropertyValue(BLUR_FACTOR_CSS_VAR).trim();
  if (!raw) return readStoredBlurFactor();
  return clampBlurFactor(Number(raw));
}

/**
 * Set redaction blur multiplier and persist it.
 * Live — no reload needed. Example: setRedactionBlurFactor(0.5)
 */
export function setRedactionBlurFactor(factor: number): number {
  const next = clampBlurFactor(factor);
  applyBlurFactorToDocument(next);
  writeStoredBlurFactor(next);
  return next;
}

export function applyStoredRedactionBlurFactor(): void {
  applyBlurFactorToDocument(readStoredBlurFactor());
}

declare global {
  interface Window {
    /** Console helper: redactionBlur.set(0.5) / .get() / .reset() */
    redactionBlur?: {
      get: () => number;
      set: (factor: number) => number;
      reset: () => number;
    };
  }
}

if (typeof window !== 'undefined') {
  applyStoredRedactionBlurFactor();
  window.redactionBlur = {
    get: getRedactionBlurFactor,
    set: setRedactionBlurFactor,
    reset: () => setRedactionBlurFactor(1),
  };
}

export function shouldObscureMedia(post: ProcessedPost | null | undefined): boolean {
  if (!post) return false;

  // TEMP DEV HACK — discard before merge. Force redaction on ~half of posts
  // (stable by id so re-renders don't flicker). Dev builds / vite serve only.
  if (
    (ACTIVE_ENV === 'dev' || Boolean(import.meta.env.DEV))
    && typeof post.id === 'number'
    && post.id % 2 === 0
  ) {
    return true;
  }

  if (post.authorization?.media === 'obscured') {
    return true;
  }
  const policy = post._retrievalPolicy;
  if (!policy) return false;
  if (policy.redactionMode === 'pixelated') {
    return true;
  }
  if (policy.imageVariant?.includes('pixelated')) {
    return true;
  }
  return false;
}
