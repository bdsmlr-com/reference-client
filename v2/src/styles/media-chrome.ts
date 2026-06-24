import { css } from 'lit';

/**
 * Media chrome tokens and layout helpers.
 *
 * Background colour while loading or letterboxing is owned exclusively by
 * `media-renderer`. Parent wrappers (.media-container, .media, etc.) should
 * only handle layout — never set a background on media slots.
 */
export const mediaChromeStyles = css`
  :host {
    --media-chrome-bg: var(--bg-panel-alt);
  }
`;

/** Layout-only shell shared by card/feed/activity wrappers around media-renderer. */
export const mediaSlotStyles = css`
  .media-slot,
  .media-container,
  .media {
    width: 100%;
    position: relative;
    overflow: hidden;
    line-height: 0;
  }
`;
