import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { baseStyles } from '../styles/theme.js';
import { getTypePreference, setTypePreference } from '../services/storage.js';
import type { PostType } from '../types/api.js';
import { POST_TYPE_ICONS, POST_TYPE_LABELS } from '../types/post.js';
import { EventNames, type TypesChangeDetail } from '../types/events.js';
import { BREAKPOINTS, SPACING, PILL_SPACING } from '../types/ui-constants.js';
import { SelectorPopoverController, selectorPopoverStyles } from './selector-popover.js';

@customElement('type-pills')
export class TypePills extends LitElement {
  static styles = [
    baseStyles,
    selectorPopoverStyles,
    css`
      .pill-group {
        gap: ${unsafeCSS(SPACING.XS)}px;
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
  private selectorPopover = new SelectorPopoverController(this, () => this.open, (next) => { this.open = next; });

  connectedCallback(): void {
    super.connectedCallback();
    this.selectorPopover.connect();
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
    this.selectorPopover.disconnect();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('selectedTypes')) {
      this.open = this.open && this.selectedTypes.length > 0;
    }
  }

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

  private closePopover(): void {
    this.selectorPopover.close();
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
          class="trigger ${this.open || !this.allSelected ? 'active' : ''}"
          @click=${this.selectorPopover.toggle}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-label=${`Filter media types: ${this.selectedTypeSummary()}`}
        >
          <span class="trigger-summary">${this.selectedTypeSummary()}</span>
        </button>
        ${this.open ? html`
          <div class="popover" role="dialog" aria-label="Choose media types" @click=${this.selectorPopover.stopPropagation}>
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
