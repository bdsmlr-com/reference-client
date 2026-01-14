import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getVariantPreference, setVariantPreference, type VariantSelection } from '../services/storage.js';
import type { PostVariant } from '../types/api.js';
import { EventNames, type VariantChangeDetail } from '../types/events.js';
import { BREAKPOINTS, SPACING, PILL_SPACING, CONTAINER_SPACING } from '../types/ui-constants.js';
import './loading-spinner.js';

@customElement('variant-pills')
export class VariantPills extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        /* UIC-021: Use standardized container spacing */
        padding: 0 ${unsafeCSS(CONTAINER_SPACING.HORIZONTAL)}px;
      }

      .pill-group {
        display: flex;
        /* UIC-021: Use standardized spacing scale */
        gap: ${unsafeCSS(SPACING.XS)}px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .variant-pill {
        /* UIC-021: Use standardized pill spacing */
        padding: ${unsafeCSS(PILL_SPACING.VERTICAL)}px ${unsafeCSS(PILL_SPACING.HORIZONTAL)}px;
        border-radius: ${unsafeCSS(SPACING.MD)}px;
        background: var(--bg-panel-alt);
        color: var(--text-muted);
        font-size: 12px;
        transition: all 0.2s;
        min-height: 28px;
        display: flex;
        align-items: center;
        gap: 3px;
      }

      .variant-pill:hover {
        background: var(--border-strong);
      }

      .variant-pill.active {
        background: var(--accent);
        color: white;
      }

      .variant-pill.loading {
        opacity: 0.7;
        pointer-events: none;
      }

      .variant-pill loading-spinner {
        --accent: white;
        --border: rgba(255, 255, 255, 0.3);
      }

      /* Mobile: max-width below BREAKPOINTS.MOBILE */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .variant-pill {
          /* UIC-021: Use standardized mobile pill spacing */
          padding: ${unsafeCSS(PILL_SPACING.VERTICAL)}px ${unsafeCSS(PILL_SPACING.HORIZONTAL_MOBILE)}px;
          font-size: 11px;
        }
      }
    `,
  ];

  @property({ type: String }) selected: VariantSelection = 'all';
  @property({ type: String }) pageName = '';
  @property({ type: Boolean }) persistSelection = true;
  @property({ type: Boolean }) loading = false;

  connectedCallback(): void {
    super.connectedCallback();
    // Load saved preference if not explicitly set via attribute
    if (this.persistSelection && this.selected === 'all') {
      const saved = getVariantPreference(this.pageName || undefined);
      if (saved && saved !== 'all') {
        this.selected = saved;
        // Emit initial change event so parent knows about saved preference
        this.dispatchEvent(
          new CustomEvent<VariantChangeDetail>(EventNames.VARIANT_CHANGE, {
            detail: { selection: saved, variants: this.getVariants(saved) },
          })
        );
      }
    }
  }

  private setSelection(selection: VariantSelection): void {
    // Update internal state to reflect button highlight
    this.selected = selection;

    // Save preference if persistence is enabled
    if (this.persistSelection) {
      setVariantPreference(selection, this.pageName || undefined);
    }
    this.dispatchEvent(
      new CustomEvent<VariantChangeDetail>(EventNames.VARIANT_CHANGE, {
        detail: { selection, variants: this.getVariants(selection) },
      })
    );
  }

  private getVariants(selection: VariantSelection): PostVariant[] | undefined {
    switch (selection) {
      case 'original':
        return [1]; // POST_VARIANT_ORIGINAL = 1
      case 'reblog':
        return [2]; // POST_VARIANT_REBLOG = 2
      default:
        return undefined; // All - no filter
    }
  }

  private getButtonClass(variant: VariantSelection): string {
    const classes = ['variant-pill'];
    if (this.selected === variant) {
      classes.push('active');
      if (this.loading) {
        classes.push('loading');
      }
    }
    return classes.join(' ');
  }

  private renderButton(variant: VariantSelection, label: string, description: string) {
    const isActiveAndLoading = this.selected === variant && this.loading;
    return html`
      <button
        class=${this.getButtonClass(variant)}
        @click=${() => this.setSelection(variant)}
        ?disabled=${this.loading}
        aria-pressed=${this.selected === variant ? 'true' : 'false'}
        aria-busy=${isActiveAndLoading ? 'true' : 'false'}
        aria-label=${description}
      >
        ${label}
        ${isActiveAndLoading
          ? html`<loading-spinner size="tiny" inline aria-hidden="true"></loading-spinner>`
          : ''}
      </button>
    `;
  }

  render() {
    return html`
      <div class="pill-group" role="group" aria-label="Filter by post variant">
        ${this.renderButton('all', 'All', 'Show all posts')}
        ${this.renderButton('original', 'Original', 'Show only original posts')}
        ${this.renderButton('reblog', 'Reblog', 'Show only reblogged posts')}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'variant-pills': VariantPills;
  }
}
