import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { EventNames, type InfiniteToggleDetail } from '../types/events.js';
import { getInfiniteScrollPreference, setInfiniteScrollPreference } from '../services/storage.js';

@customElement('infinite-scroll-toggle')
export class InfiniteScrollToggle extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
      }

      .toggle {
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
        user-select: none;
      }

      .toggle:hover {
        background: var(--border-strong);
      }

      .toggle.active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
    `,
  ];

  @property({ type: Boolean }) enabled = false;
  @property({ type: String }) pageName = '';
  @property({ type: Boolean }) persistSelection = true;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.persistSelection) {
      this.enabled = getInfiniteScrollPreference(this.pageName || undefined);
    }
  }

  private toggle(): void {
    this.enabled = !this.enabled;
    if (this.persistSelection) {
      setInfiniteScrollPreference(this.enabled, this.pageName || undefined);
    }
    this.dispatchEvent(new CustomEvent<InfiniteToggleDetail>(EventNames.INFINITE_TOGGLE, {
      detail: { enabled: this.enabled },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <button
        type="button"
        class="toggle ${this.enabled ? 'active' : ''}"
        @click=${this.toggle}
        aria-pressed=${this.enabled ? 'true' : 'false'}
        aria-label=${`${this.enabled ? 'Disable' : 'Enable'} infinite scroll`}
      >
        ∞ scroll
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'infinite-scroll-toggle': InfiniteScrollToggle;
  }
}
