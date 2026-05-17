import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { SORT_OPTIONS } from '../types/post.js';
import { BREAKPOINTS, SPACING } from '../types/ui-constants.js';
import { EventNames, type SortChangeDetail, type SortOptionLockedDetail } from '../types/events.js';
import { SelectorPopoverController, selectorPopoverStyles } from './selector-popover.js';

interface SortOption {
  value: string;
  label: string;
}

@customElement('sort-controls')
export class SortControls extends LitElement {
  static styles = [
    baseStyles,
    selectorPopoverStyles,
    css`
      :host {
        display: inline-flex;
      }

      select {
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 14px;
        cursor: pointer;
        min-height: 44px;
      }

      select:focus {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .sort-pill-group {
        display: flex;
        gap: 6px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .sort-pill {
        min-height: 28px;
        padding: 6px 12px;
        border-radius: ${unsafeCSS(SPACING.MD)}px;
        background: var(--bg-panel-alt);
        color: var(--text-muted);
        font-size: 12px;
        transition: all 0.2s;
        border: 1px solid transparent;
      }

      .sort-pill:hover {
        background: var(--border-strong);
      }

      .sort-pill.active {
        background: var(--accent);
        color: #fff;
      }

      .sort-pill.locked {
        background: rgba(166, 67, 67, 0.14);
        color: var(--text-primary);
        border-color: rgba(166, 67, 67, 0.35);
      }

      .sort-pill.locked:hover {
        background: rgba(166, 67, 67, 0.2);
      }

      .sort-pill.locked.active {
        background: rgba(166, 67, 67, 0.72);
        color: #fff;
      }

      .sort-trigger {
        min-width: 0;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .sort-pill {
          padding: 6px 10px;
          font-size: 11px;
        }
      }
    `,
  ];

  @property({ type: String }) value = '1:0';
  @property({ attribute: false }) options: SortOption[] = SORT_OPTIONS;
  @property({ type: Array }) lockedValues: string[] = [];

  @state() private open = false;
  private selectorPopover = new SelectorPopoverController(this, () => this.open, (next) => { this.open = next; });

  connectedCallback(): void {
    super.connectedCallback();
    this.selectorPopover.connect();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.selectorPopover.disconnect();
  }

  private handleChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this.dispatchEvent(
      new CustomEvent<SortChangeDetail>(EventNames.SORT_CHANGE, {
        detail: { value: select.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  private hasLockedOptions(): boolean {
    return Array.isArray(this.lockedValues) && this.lockedValues.length > 0;
  }

  private isLocked(value: string): boolean {
    return this.hasLockedOptions() && this.lockedValues.includes(value);
  }

  private selectedLabel(options: SortOption[]): string {
    return options.find((opt) => opt.value === this.value)?.label || 'Sort';
  }

  private dispatchLocked(option: SortOption): void {
    this.dispatchEvent(
      new CustomEvent<SortOptionLockedDetail>(EventNames.SORT_OPTION_LOCKED, {
        detail: { value: option.value, label: option.label },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleOptionClick(option: SortOption): void {
    if (this.isLocked(option.value)) {
      this.dispatchLocked(option);
      this.open = false;
      return;
    }
    this.dispatchEvent(
      new CustomEvent<SortChangeDetail>(EventNames.SORT_CHANGE, {
        detail: { value: option.value },
        bubbles: true,
        composed: true,
      })
    );
    this.open = false;
  }

  render() {
    const options = Array.isArray(this.options) && this.options.length ? this.options : SORT_OPTIONS;
    if (!this.hasLockedOptions()) {
      return html`
        <select
          .value=${this.value}
          @change=${this.handleChange}
          aria-label="Sort posts by"
        >
          ${options.map(
            (opt) => html`
              <option value=${opt.value} ?selected=${opt.value === this.value}>
                ${opt.label}
              </option>
            `
          )}
        </select>
      `;
    }

    return html`
      <div class="selector">
        <button
          type="button"
          class="trigger sort-trigger ${this.open || this.value !== options[0]?.value ? 'active' : ''}"
          @click=${this.selectorPopover.toggle}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-label=${`Sort posts by: ${this.selectedLabel(options)}`}
        >
          <span class="trigger-summary">${this.selectedLabel(options)}</span>
        </button>
        ${this.open ? html`
          <div class="popover" role="dialog" aria-label="Choose sort order" @click=${this.selectorPopover.stopPropagation}>
            <div class="sort-pill-group" role="group" aria-label="Choose archive sort order">
              ${options.map(
                (opt) => html`
                  <button
                    type="button"
                    class=${['sort-pill', opt.value === this.value ? 'active' : '', this.isLocked(opt.value) ? 'locked' : ''].join(' ').trim()}
                    @click=${() => this.handleOptionClick(opt)}
                    aria-pressed=${opt.value === this.value ? 'true' : 'false'}
                    aria-disabled=${this.isLocked(opt.value) ? 'true' : 'false'}
                    aria-label=${this.isLocked(opt.value) ? `${opt.label} locked` : `Sort by ${opt.label}`}
                  >
                    ${opt.label}
                  </button>
                `
              )}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sort-controls': SortControls;
  }
}
