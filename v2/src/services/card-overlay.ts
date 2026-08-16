import { html, nothing, type TemplateResult } from 'lit';
import type { ResolvedLink } from './link-resolver.js';

export function shouldLetBrowserHandleCardLink(
  event: MouseEvent,
  options: { lockNavigation?: boolean } = {},
): boolean {
  if (options.lockNavigation) {
    return false;
  }
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function renderCardOverlayLink(
  permalink: ResolvedLink,
  ariaLabel: string,
  onClick: (event: MouseEvent) => void,
  mediaFailed = false,
  options: { lockNavigation?: boolean } = {},
): TemplateResult | typeof nothing {
  if (mediaFailed) return nothing;
  const lockNavigation = options.lockNavigation === true;
  return html`<a
    class="card-overlay-link"
    href=${lockNavigation ? nothing : permalink.href}
    target=${lockNavigation ? nothing : permalink.target}
    rel=${lockNavigation ? nothing : (permalink.rel || nothing)}
    title=${permalink.title || nothing}
    aria-label=${ariaLabel}
    @click=${onClick}
    @auxclick=${lockNavigation ? onClick : nothing}
    @contextmenu=${lockNavigation ? onClick : nothing}
  ></a>`;
}
