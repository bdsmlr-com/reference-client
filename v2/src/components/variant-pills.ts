import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { baseStyles } from '../styles/theme.js';
import { getVariantPreference, setVariantPreference, type VariantSelection } from '../services/storage.js';
import type { PostVariant } from '../types/api.js';
import { EventNames, type VariantChangeDetail } from '../types/events.js';
import { BREAKPOINTS, SPACING, PILL_SPACING } from '../types/ui-constants.js';
import { SelectorPopoverController, selectorPopoverStyles } from './selector-popover.js';
import './loading-spinner.js';

@customElement('variant-pills')
export class VariantPills extends LitElement {
  static styles = [
    baseStyles,
    selectorPopoverStyles,
    css`
      .pill-group {
        gap: ${unsafeCSS(SPACING.XS)}px;
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

  @state() private open = false;
  private selectorPopover = new SelectorPopoverController(this, () => this.open, (next) => { this.open = next; });

  connectedCallback(): void {
    super.connectedCallback();
    this.selectorPopover.connect();
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
    this.selectorPopover.disconnect();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('selectedVariants')) {
      this.selected = this.selectionFromVariants(this.selectedVariants);
    }
  }

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

  render() {
    return html`
      <div class="selector">
        <button
          type="button"
          class="trigger ${this.open || this.selected !== 'all' ? 'active' : ''}"
          @click=${this.selectorPopover.toggle}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-label=${`Filter post variants: ${this.variantSummary()}`}
        >
          <span class="trigger-summary">${this.variantSummary()}</span>
        </button>
        ${this.open ? html`
          <div class="popover" role="dialog" aria-label="Choose post variants" @click=${this.selectorPopover.stopPropagation}>
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
