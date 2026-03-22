import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ActivityKind } from '../services/profile.js';

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

  @property({ type: Array }) selected: ActivityKind[] = ['post', 'reblog', 'like', 'comment'];

  private toggle(kind: ActivityKind): void {
    const next = this.selected.includes(kind)
      ? this.selected.filter((k) => k !== kind)
      : [...this.selected, kind];
    this.dispatchEvent(new CustomEvent('activity-kinds-change', { detail: { kinds: next } }));
  }

  render() {
    return html`
      <div class="pill-group" role="group" aria-label="Filter activity types">
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
