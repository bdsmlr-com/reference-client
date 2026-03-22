import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { RenderElementConfig } from '../config';
import { resolveBinding } from '../services/render-binding.js';

@customElement('render-element')
export class RenderElement extends LitElement {
  @property({ type: Object }) config: RenderElementConfig | null = null;
  @property({ type: Object }) model: Record<string, unknown> = {};
  @property({ type: String }) binding = '';

  createRenderRoot() {
    return this;
  }

  render() {
    if (!this.config) return nothing;
    const value = this.binding ? resolveBinding(this.model, this.binding) : '';
    const primitive = this.config.primitive || 'text';

    if (primitive === 'badge') return html`<span class="badge">${String(value ?? '')}</span>`;
    if (primitive === 'chip') return html`<span class="chip">${String(value ?? '')}</span>`;
    if (primitive === 'link') return html`<a href="#">${String(value ?? '')}</a>`;
    return html`<span>${String(value ?? '')}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'render-element': RenderElement;
  }
}
