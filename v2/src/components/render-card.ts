import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { loadRenderContract } from '../services/render-contract.js';
import type { RenderSkeletonConfig } from '../config';
import './skeleton-loader.js';

export function getCardSkeletonPlan(cardType: string): RenderSkeletonConfig | undefined {
  const contract = loadRenderContract();
  return contract.cards[cardType]?.skeleton;
}

@customElement('render-card')
export class RenderCard extends LitElement {
  @property({ type: String }) cardType = '';
  @property({ type: Boolean }) loading = false;
  @property({ type: Number }) count?: number;

  createRenderRoot() {
    return this;
  }

  render() {
    if (this.loading) {
      const skeleton = getCardSkeletonPlan(this.cardType);
      if (!skeleton) return nothing;
      const skeletonCount = this.count ?? skeleton.count_policy.default;
      return html`<skeleton-loader variant=${skeleton.variant} count=${skeletonCount}></skeleton-loader>`;
    }
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'render-card': RenderCard;
  }
}
