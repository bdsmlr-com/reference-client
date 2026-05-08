import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ActivityKind } from '../services/profile.js';
import { BREAKPOINTS, PILL_SPACING, SPACING } from '../types/ui-constants.js';

const ALL_KINDS: ActivityKind[] = ['post', 'reblog', 'like', 'comment'];
const OPTIONS: Array<{ key: ActivityKind; label: string; icon: string }> = [
  { key: 'post', label: 'Posts', icon: '📝' },
  { key: 'reblog', label: 'Reblogs', icon: '♻️' },
  { key: 'like', label: 'Likes', icon: '❤️' },
  { key: 'comment', label: 'Comments', icon: '💬' },
];

@customElement('activity-kind-pills')
export class ActivityKindPills extends LitElement {
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

      .pill {
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

      .pill:hover {
        background: var(--border-strong);
      }

      .pill.active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        .trigger {
          font-size: 11px;
          padding: 0 12px;
        }

        .pill {
          padding: ${unsafeCSS(PILL_SPACING.VERTICAL)}px ${unsafeCSS(PILL_SPACING.HORIZONTAL_MOBILE)}px;
          font-size: 11px;
        }
      }
    `,
  ];

  @property({ type: Array }) selected: ActivityKind[] = [...ALL_KINDS];

  @state() private open = false;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('click', this.handleWindowClick);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('click', this.handleWindowClick);
  }

  private handleWindowClick = (event: Event): void => {
    if (!this.open) return;
    const path = event.composedPath();
    if (!path.includes(this)) {
      this.open = false;
    }
  };

  private toggle(kind: ActivityKind): void {
    if (this.selected.length === ALL_KINDS.length && this.selected.every((k) => ALL_KINDS.includes(k))) {
      this.selected = [];
    }
    const next = this.selected.includes(kind)
      ? this.selected.filter((k) => k !== kind)
      : [...this.selected, kind];
    this.dispatchEvent(new CustomEvent('activity-kinds-change', { detail: { kinds: next } }));
  }

  private selectAll = (): void => {
    this.dispatchEvent(new CustomEvent('activity-kinds-change', { detail: { kinds: [...ALL_KINDS] } }));
  };

  private toggleSelector = (e: Event): void => {
    e.stopPropagation();
    this.open = !this.open;
  };

  private selectedSummary(): string {
    if (this.selected.length === 0 || this.selected.length === ALL_KINDS.length) {
      return 'All activity';
    }
    const labels = OPTIONS.filter((option) => this.selected.includes(option.key)).map((option) => option.label);
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  }

  render() {
    const isAllSelected = this.selected.length === ALL_KINDS.length && this.selected.every((k) => ALL_KINDS.includes(k));
    return html`
      <div class="selector">
        <button
          type="button"
          class="trigger ${this.open || !isAllSelected ? 'active' : ''}"
          @click=${this.toggleSelector}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-label=${`Filter activity types: ${this.selectedSummary()}`}
        >
          <span class="trigger-summary">${this.selectedSummary()}</span>
        </button>
        ${this.open ? html`
          <div class="popover" role="dialog" aria-label="Choose activity types" @click=${(event: Event) => event.stopPropagation()}>
            <div class="pill-group" role="group" aria-label="Filter activity types">
              <button
                type="button"
                class="pill ${isAllSelected ? 'active' : ''}"
                @click=${this.selectAll}
                aria-pressed=${isAllSelected ? 'true' : 'false'}
              >All</button>
              ${OPTIONS.map((opt) => html`
                <button
                  type="button"
                  class="pill ${this.selected.includes(opt.key) ? 'active' : ''}"
                  @click=${() => this.toggle(opt.key)}
                  aria-pressed=${this.selected.includes(opt.key) ? 'true' : 'false'}
                >${opt.icon} ${opt.label}</button>
              `)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'activity-kind-pills': ActivityKindPills;
  }
}
