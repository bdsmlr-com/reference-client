import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { loadRenderContract } from '../services/render-contract.js';
import type { RenderSkeletonConfig } from '../config.js';
import './skeleton-loader.js';
import './render-element.js';

export function getCardSkeletonPlan(cardType: string): RenderSkeletonConfig | undefined {
  const contract = loadRenderContract();
  return contract.cards[cardType]?.skeleton;
}

export function getCardRegionOrder(cardType: string, mode: 'regular' | 'admin' = 'regular'): string[] {
  const contract = loadRenderContract();
  const card = contract.cards[cardType];
  if (!card?.regions) return [];
  const override = card.mode_overrides?.[mode]?.region_order;
  if (override && override.length > 0) return override;
  return Object.keys(card.regions);
}

@customElement('render-card')
export class RenderCard extends LitElement {
  @property({ type: String }) cardType = '';
  @property({ type: Boolean }) loading = false;
  @property({ type: Number }) count?: number;
  @property({ type: String }) mode: 'regular' | 'admin' = 'regular';

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

    const contract = loadRenderContract();
    const card = contract.cards[this.cardType];
    if (!card?.regions) return html`<slot></slot>`;

    const regionOrder = getCardRegionOrder(this.cardType, this.mode);
    return html`
      ${regionOrder.map((regionId) => {
        const regionElements = card.regions?.[regionId as keyof typeof card.regions] || [];
        return html`
          <section data-region=${regionId}>
            ${regionElements.map((elementId) => {
              const elementConfig = contract.elements[elementId];
              if (!elementConfig) return nothing;
              return html`<render-element .config=${elementConfig}></render-element>`;
            })}
          </section>
        `;
      })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'render-card': RenderCard;
  }
}
