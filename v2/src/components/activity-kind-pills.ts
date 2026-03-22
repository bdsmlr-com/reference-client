import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ActivityKind } from '../services/profile.js';

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
      :host { display: block; }
      .pill-group {
        display: flex;
        gap: 6px;
        justify-content: center;
        flex-wrap: wrap;
      }
      .pill {
        padding: 6px 10px;
        border-radius: 14px;
        background: var(--bg-panel-alt);
        border: 1px solid var(--border);
        color: var(--text-muted);
        font-size: 12px;
      }
      .pill.active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
    `,
  ];

  @property({ type: Array }) selected: ActivityKind[] = [...ALL_KINDS];

  private toggle(kind: ActivityKind): void {
    if (this.selected.length === ALL_KINDS.length && this.selected.every((k) => ALL_KINDS.includes(k))) {
      // Start from empty set to make toggling from "All" intuitive.
      this.selected = [];
    }
    const next = this.selected.includes(kind)
      ? this.selected.filter((k) => k !== kind)
      : [...this.selected, kind];
    this.dispatchEvent(new CustomEvent('activity-kinds-change', { detail: { kinds: next } }));
  }

  private selectAll(): void {
    this.dispatchEvent(new CustomEvent('activity-kinds-change', { detail: { kinds: [...ALL_KINDS] } }));
  }

  render() {
    const isAllSelected = this.selected.length === ALL_KINDS.length && this.selected.every((k) => ALL_KINDS.includes(k));
    return html`
      <div class="pill-group" role="group" aria-label="Filter activity types">
        <button
          class="pill ${isAllSelected ? 'active' : ''}"
          @click=${this.selectAll}
          aria-pressed=${isAllSelected ? 'true' : 'false'}
        >All</button>
        ${OPTIONS.map((opt) => html`
          <button
            class="pill ${this.selected.includes(opt.key) ? 'active' : ''}"
            @click=${() => this.toggle(opt.key)}
            aria-pressed=${this.selected.includes(opt.key) ? 'true' : 'false'}
          >${opt.icon} ${opt.label}</button>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'activity-kind-pills': ActivityKindPills;
  }
}
