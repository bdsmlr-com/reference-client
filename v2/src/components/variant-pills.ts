import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { baseStyles } from '../styles/theme.js';
import { getVariantPreference, setVariantPreference, type VariantSelection } from '../services/storage.js';
import type { PostVariant } from '../types/api.js';
import { EventNames, type VariantChangeDetail } from '../types/events.js';
import { BREAKPOINTS, SPACING, PILL_SPACING } from '../types/ui-constants.js';
import './loading-spinner.js';

@customElement('variant-pills')
export class VariantPills extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        position: relative;
        min-width: 0;
      }

      .selector {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .trigger {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 0 14px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.2s, border-color 0.2s;
      }

      .trigger:hover {
        background: var(--border-strong);
      }

      .trigger.active {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent);
      }

      .trigger-summary {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .popover {
        position: absolute;
        top: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        width: min(92vw, 420px);
        padding: 12px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--surface-raised, var(--surface-primary, #fff));
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.12);
        z-index: 30;
      }

      .pill-group {
        display: flex;
        gap: ${unsafeCSS(SPACING.XS)}px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .variant-pill {
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
        .trigger {
          font-size: 11px;
          padding: 0 12px;
        }

        .variant-pill {
          padding: ${unsafeCSS(PILL_SPACING.VERTICAL)}px ${unsafeCSS(PILL_SPACING.HORIZONTAL_MOBILE)}px;
          font-size: 11px;
        }
      }
    `,
  ];

  @property({ type: String }) selected: VariantSelection = 'all';
  @property({ type: Array }) selectedVariants: PostVariant[] = [];
  @property({ type: String }) pageName = '';
  @property({ type: Boolean }) persistSelection = true;
  @property({ type: Boolean }) loading = false;

  private open = false;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('click', this.handleWindowClick);
    const explicitSelection = this.selectionFromVariants(this.selectedVariants);
    if (explicitSelection !== 'all') {
      this.selected = explicitSelection;
      return;
    }
    if (this.persistSelection && this.selected === 'all') {
      const saved = getVariantPreference(this.pageName || undefined);
      if (saved && saved !== 'all') {
        this.selected = saved;
        this.dispatchEvent(
          new CustomEvent<VariantChangeDetail>(EventNames.VARIANT_CHANGE, {
            detail: { selection: saved, variants: this.getVariants(saved) },
          })
        );
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('click', this.handleWindowClick);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('selectedVariants')) {
      this.selected = this.selectionFromVariants(this.selectedVariants);
    }
  }

  private handleWindowClick = (event: Event): void => {
    if (!this.open) return;
    const path = event.composedPath();
    if (!path.includes(this)) {
      this.open = false;
    }
  };

  private setSelection(selection: VariantSelection): void {
    this.selected = selection;
    if (this.persistSelection) {
      setVariantPreference(selection, this.pageName || undefined);
    }
    this.dispatchEvent(
      new CustomEvent<VariantChangeDetail>(EventNames.VARIANT_CHANGE, {
        detail: { selection, variants: this.getVariants(selection) },
      })
    );
    this.open = false;
  }

  private getVariants(selection: VariantSelection): PostVariant[] | undefined {
    switch (selection) {
      case 'original':
        return [1];
      case 'reblog':
        return [2];
      default:
        return undefined;
    }
  }

  private selectionFromVariants(variants: PostVariant[] | undefined): VariantSelection {
    const values = Array.isArray(variants) ? variants : [];
    const unique = [...new Set(values)];
    if (unique.length === 1 && unique[0] === 1) return 'original';
    if (unique.length === 1 && unique[0] === 2) return 'reblog';
    return 'all';
  }

  private variantSummary(): string {
    switch (this.selected) {
      case 'original':
        return 'Original posts';
      case 'reblog':
        return 'Reblogged posts';
      default:
        return 'All posts';
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
        type="button"
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

  private toggleSelector(e: Event): void {
    e.stopPropagation();
    this.open = !this.open;
  }

  render() {
    return html`
      <div class="selector">
        <button
          type="button"
          class="trigger ${this.open || this.selected !== 'all' ? 'active' : ''}"
          @click=${this.toggleSelector}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-label=${`Filter post variants: ${this.variantSummary()}`}
        >
          <span class="trigger-summary">${this.variantSummary()}</span>
        </button>
        ${this.open ? html`
          <div class="popover" role="dialog" aria-label="Choose post variants" @click=${(event: Event) => event.stopPropagation()}>
            <div class="pill-group" role="group" aria-label="Filter by post variant">
              ${this.renderButton('original', 'Original', 'Show only original posts')}
              ${this.renderButton('reblog', 'Reblog', 'Show only reblogged posts')}
              ${this.renderButton('all', 'All', 'Show all posts')}
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:10px;">
              <button type="button" class="trigger" @click=${() => (this.open = false)}>Close</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'variant-pills': VariantPills;
  }
}
