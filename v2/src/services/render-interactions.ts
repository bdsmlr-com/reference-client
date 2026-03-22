import { resolveLink } from './link-resolver.js';

export interface RenderInteractionSpec {
  type: 'open_lightbox' | 'navigate' | 'emit_event' | 'toggle';
  linkContext?: string;
  eventName?: string;
  stopPropagation?: boolean;
  preventDefault?: boolean;
}

export interface RenderInteractionContext {
  host?: HTMLElement;
  params?: Record<string, string | number>;
  payload?: unknown;
}

export function buildInteractionHandler(spec: RenderInteractionSpec) {
  return (ctx: RenderInteractionContext = {}, ev?: Event): void => {
    if (ev && spec.preventDefault) ev.preventDefault();
    if (ev && spec.stopPropagation) ev.stopPropagation();

    if (spec.type === 'navigate') {
      if (!spec.linkContext) throw new Error('navigate interaction missing linkContext');
      const link = resolveLink(spec.linkContext, ctx.params || {});
      if (link.target === '_blank') {
        window.open(link.href, '_blank', link.rel || 'noopener,noreferrer');
        return;
      }
      window.location.href = link.href;
      return;
    }

    if (spec.type === 'emit_event') {
      if (!spec.eventName) throw new Error('emit_event interaction missing eventName');
      const event = new CustomEvent(spec.eventName, {
        detail: ctx.payload,
        bubbles: true,
        composed: true,
      });
      (ctx.host || window).dispatchEvent(event);
      return;
    }

    if (spec.type === 'open_lightbox') {
      const event = new CustomEvent('post-click', {
        detail: ctx.payload,
        bubbles: true,
        composed: true,
      });
      (ctx.host || window).dispatchEvent(event);
      return;
    }

    if (spec.type === 'toggle') {
      if (ctx.host) {
        ctx.host.toggleAttribute('data-open');
      }
    }
  };
}
