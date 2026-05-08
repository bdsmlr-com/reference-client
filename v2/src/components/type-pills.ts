import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { baseStyles } from '../styles/theme.js';
import { getTypePreference, setTypePreference } from '../services/storage.js';
import type { PostType } from '../types/api.js';
import { POST_TYPE_ICONS, POST_TYPE_LABELS } from '../types/post.js';
import { EventNames, type TypesChangeDetail } from '../types/events.js';
import { BREAKPOINTS, SPACING, PILL_SPACING } from '../types/ui-constants.js';

@customElement('type-pills')
export class TypePills extends LitElement {
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

      .type-pill {
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

      .type-pill:hover {
        background: var(--border-strong);
      }

      .type-pill.active {
        background: var(--accent);
        color: white;
      }

      .type-pill.loading {
        opacity: 0.7;
        pointer-events: none;
      }

      /* Mobile: max-width below BREAKPOINTS.MOBILE */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .trigger {
          font-size: 11px;
          padding: 0 12px;
        }

        .type-pill {
          padding: ${unsafeCSS(PILL_SPACING.VERTICAL)}px ${unsafeCSS(PILL_SPACING.HORIZONTAL_MOBILE)}px;
          font-size: 11px;
        }
      }
    `,
  ];

  @property({ type: Array }) selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @property({ type: String }) pageName = '';
  @property({ type: Boolean }) persistSelection = true;

  private allTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];
  @state() private open = false;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('click', this.handleWindowClick);
    if (this.persistSelection) {
      const saved = getTypePreference(this.pageName || undefined);
      if (saved && saved.length > 0 && saved.length < 7) {
        this.selectedTypes = saved as PostType[];
        this.dispatchEvent(
          new CustomEvent<TypesChangeDetail>(EventNames.TYPES_CHANGE, {
            detail: { types: saved as PostType[] },
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
    if (changed.has('selectedTypes')) {
      this.open = this.open && this.selectedTypes.length > 0;
    }
  }

  private handleWindowClick = (event: Event): void => {
    if (!this.open) return;
    const path = event.composedPath();
    if (!path.includes(this)) {
      this.open = false;
    }
  };

  private get allSelected(): boolean {
    return this.allTypes.every((t) => this.selectedTypes.includes(t));
  }

  private selectedTypeSummary(): string {
    const selected = this.allTypes.filter((type) => this.selectedTypes.includes(type));
    if (selected.length === 0 || selected.length === this.allTypes.length) {
      return 'All media';
    }
    const labels = selected.map((type) => POST_TYPE_LABELS[type]);
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  }

  private toggleSelector(e: Event): void {
    e.stopPropagation();
    this.open = !this.open;
  }

  private closePopover(): void {
    this.open = false;
  }

  private toggleType(type: PostType): void {
    const hasType = this.selectedTypes.includes(type);
    const newSelected = hasType
      ? this.selectedTypes.filter((t) => t !== type)
      : [...this.selectedTypes, type];
    if (this.persistSelection) {
      setTypePreference(newSelected, this.pageName || undefined);
    }
    this.dispatchEvent(
      new CustomEvent<TypesChangeDetail>(EventNames.TYPES_CHANGE, {
        detail: { types: newSelected },
      })
    );
  }

  private toggleAll(): void {
    const newSelected = this.allSelected ? [] : [...this.allTypes];
    if (this.persistSelection) {
      setTypePreference(newSelected, this.pageName || undefined);
    }
    this.dispatchEvent(
      new CustomEvent<TypesChangeDetail>(EventNames.TYPES_CHANGE, {
        detail: { types: newSelected },
      })
    );
  }

  private getButtonClass(type: PostType): string {
    const classes = ['type-pill'];
    if (this.selectedTypes.includes(type)) {
      classes.push('active');
    }
    return classes.join(' ');
  }

  render() {
    return html`
      <div class="selector">
        <button
          type="button"
          class="trigger ${this.open || this.allSelected ? 'active' : ''}"
          @click=${this.toggleSelector}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-label=${`Filter media types: ${this.selectedTypeSummary()}`}
        >
          <span class="trigger-summary">${this.selectedTypeSummary()}</span>
        </button>
        ${this.open ? html`
          <div class="popover" role="dialog" aria-label="Choose media types" @click=${(event: Event) => event.stopPropagation()}>
            <div class="pill-group" role="group" aria-label="Filter by post type">
              <button
                type="button"
                class="type-pill ${this.allSelected ? 'active' : ''}"
                @click=${this.toggleAll}
                aria-pressed=${this.allSelected ? 'true' : 'false'}
                aria-label="Select all post types"
              >
                All
              </button>
              ${this.allTypes.map(
                (type) => html`
                  <button
                    type="button"
                    class=${this.getButtonClass(type)}
                    @click=${() => this.toggleType(type)}
                    aria-pressed=${this.selectedTypes.includes(type) ? 'true' : 'false'}
                    aria-label=${`Filter by ${POST_TYPE_LABELS[type]} posts`}
                  >
                    <span aria-hidden="true">${POST_TYPE_ICONS[type]}</span> ${POST_TYPE_LABELS[type]}
                  </button>
                `
              )}
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:10px;">
              <button type="button" class="trigger" @click=${() => this.closePopover()}>Close</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'type-pills': TypePills;
  }
}
