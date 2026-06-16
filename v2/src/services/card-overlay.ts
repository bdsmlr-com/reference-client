import { html, nothing, type TemplateResult } from 'lit';
import type { ResolvedLink } from './link-resolver.js';

export function shouldLetBrowserHandleCardLink(event: MouseEvent): boolean {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function renderCardOverlayLink(
  permalink: ResolvedLink,
  ariaLabel: string,
  onClick: (event: MouseEvent) => void,
  mediaFailed = false,
): TemplateResult | typeof nothing {
  if (mediaFailed) return nothing;
  return html`<a
    class="card-overlay-link"
    href=${permalink.href}
    target=${permalink.target}
    rel=${permalink.rel || nothing}
    title=${permalink.title || nothing}
    aria-label=${ariaLabel}
    @click=${onClick}
  ></a>`;
}
