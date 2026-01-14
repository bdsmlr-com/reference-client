import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getTypePreference, setTypePreference } from '../services/storage.js';
import type { PostType } from '../types/api.js';
import { POST_TYPE_ICONS, POST_TYPE_LABELS } from '../types/post.js';
import { EventNames, type TypesChangeDetail } from '../types/events.js';
import { BREAKPOINTS, SPACING, PILL_SPACING, CONTAINER_SPACING } from '../types/ui-constants.js';

@customElement('type-pills')
export class TypePills extends LitElement {
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

      .type-pill {
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

      .type-pill:hover {
        background: var(--border-strong);
      }

      .type-pill.active {
        background: var(--accent);
        color: white;
      }

      /* Mobile: max-width below BREAKPOINTS.MOBILE */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .type-pill {
          /* UIC-021: Use standardized mobile pill spacing */
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

  connectedCallback(): void {
    super.connectedCallback();
    // Load saved preference if persistence is enabled
    if (this.persistSelection) {
      const saved = getTypePreference(this.pageName || undefined);
      if (saved && saved.length > 0 && saved.length < 7) {
        this.selectedTypes = saved as PostType[];
        // Emit initial change event so parent knows about saved preference
        this.dispatchEvent(
          new CustomEvent<TypesChangeDetail>(EventNames.TYPES_CHANGE, {
            detail: { types: saved as PostType[] },
          })
        );
      }
    }
  }

  private get allSelected(): boolean {
    return this.allTypes.every((t) => this.selectedTypes.includes(t));
  }

  private toggleType(type: PostType): void {
    let newSelected: PostType[];
    if (this.selectedTypes.includes(type)) {
      newSelected = this.selectedTypes.filter((t) => t !== type);
    } else {
      newSelected = [...this.selectedTypes, type];
    }
    // Save preference if persistence is enabled
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
    // Save preference if persistence is enabled
    if (this.persistSelection) {
      setTypePreference(newSelected, this.pageName || undefined);
    }
    this.dispatchEvent(
      new CustomEvent<TypesChangeDetail>(EventNames.TYPES_CHANGE, {
        detail: { types: newSelected },
      })
    );
  }

  render() {
    return html`
      <div class="pill-group" role="group" aria-label="Filter by post type">
        <button
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
              class="type-pill ${this.selectedTypes.includes(type) ? 'active' : ''}"
              @click=${() => this.toggleType(type)}
              aria-pressed=${this.selectedTypes.includes(type) ? 'true' : 'false'}
              aria-label="Filter by ${POST_TYPE_LABELS[type]} posts"
            >
              <span aria-hidden="true">${POST_TYPE_ICONS[type]}</span> ${POST_TYPE_LABELS[type]}
            </button>
          `
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'type-pills': TypePills;
  }
}
