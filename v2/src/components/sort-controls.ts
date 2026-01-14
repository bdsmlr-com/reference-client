import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { SORT_OPTIONS } from '../types/post.js';
import { EventNames, type SortChangeDetail } from '../types/events.js';

@customElement('sort-controls')
export class SortControls extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
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
    `,
  ];

  @property({ type: String }) value = '1:0';

  private handleChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this.dispatchEvent(
      new CustomEvent<SortChangeDetail>(EventNames.SORT_CHANGE, {
        detail: { value: select.value },
      })
    );
  }

  render() {
    return html`
      <select
        .value=${this.value}
        @change=${this.handleChange}
        aria-label="Sort posts by"
      >
        ${SORT_OPTIONS.map(
          (opt) => html`
            <option value=${opt.value} ?selected=${opt.value === this.value}>
              ${opt.label}
            </option>
          `
        )}
      </select>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sort-controls': SortControls;
  }
}
