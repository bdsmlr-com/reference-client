import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { PostType, PostVariant } from '../types/api.js';
import './type-pills.js';
import './variant-pills.js';
import './sort-controls.js';

@customElement('filter-bar')
export class FilterBar extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        margin-bottom: 20px;
        padding: 0 16px;
      }

      .filters-container {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      .pills-separator {
        color: var(--border);
        font-size: 18px;
        user-select: none;
      }

      @media (max-width: 600px) {
        .filters-container {
          flex-direction: column;
          gap: 16px;
        }
        .pills-separator {
          display: none;
        }
      }
    `,
  ];

  @property({ type: String }) sortValue = '';
  @property({ type: Array }) selectedTypes: PostType[] = [];
  @property({ type: Array }) selectedVariants: PostVariant[] = [];
  @property({ type: Boolean }) showSort = false;
  @property({ type: Boolean }) showVariants = false;
  @property({ type: Boolean }) loading = false;

  private handleSortChange(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('sort-change', { detail: e.detail }));
  }

  private handleTypesChange(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('types-change', { detail: e.detail }));
  }

  private handleVariantChange(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('variant-change', { detail: e.detail }));
  }

  render() {
    return html`
      <div class="filters-container">
        ${this.showSort ? html`
          <sort-controls 
            .value=${this.sortValue} 
            @sort-change=${this.handleSortChange}
          ></sort-controls>
          <span class="pills-separator">|</span>
        ` : nothing}

        <type-pills
          .selectedTypes=${this.selectedTypes}
          @types-change=${this.handleTypesChange}
        ></type-pills>

        ${this.showVariants ? html`
          <span class="pills-separator">|</span>
          <variant-pills
            .loading=${this.loading}
            .selectedVariants=${this.selectedVariants}
            @variant-change=${this.handleVariantChange}
          ></variant-pills>
        ` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'filter-bar': FilterBar;
  }
}
