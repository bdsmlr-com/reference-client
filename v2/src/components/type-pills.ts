import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { PostType } from '../types/api.js';
import { POST_TYPE_ICONS, POST_TYPE_LABELS } from '../types/post.js';

@customElement('type-pills')
export class TypePills extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: flex;
        gap: 6px;
        justify-content: center;
        flex-wrap: wrap;
        padding: 0 16px;
      }

      .type-pill {
        padding: 8px 14px;
        border-radius: 20px;
        background: var(--bg-panel-alt);
        color: var(--text-muted);
        font-size: 13px;
        transition: all 0.2s;
        min-height: 44px;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .type-pill:hover {
        background: var(--border-strong);
      }

      .type-pill.active {
        background: var(--accent);
        color: white;
      }

      @media (max-width: 480px) {
        .type-pill {
          padding: 6px 10px;
          font-size: 12px;
        }
      }
    `,
  ];

  @property({ type: Array }) selectedTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];

  private allTypes: PostType[] = [1, 2, 3, 4, 5, 6, 7];

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
    this.dispatchEvent(
      new CustomEvent('types-change', {
        detail: { types: newSelected },
      })
    );
  }

  private toggleAll(): void {
    const newSelected = this.allSelected ? [] : [...this.allTypes];
    this.dispatchEvent(
      new CustomEvent('types-change', {
        detail: { types: newSelected },
      })
    );
  }

  render() {
    return html`
      <button
        class="type-pill ${this.allSelected ? 'active' : ''}"
        @click=${this.toggleAll}
      >
        All
      </button>
      ${this.allTypes.map(
        (type) => html`
          <button
            class="type-pill ${this.selectedTypes.includes(type) ? 'active' : ''}"
            @click=${() => this.toggleType(type)}
          >
            ${POST_TYPE_ICONS[type]} ${POST_TYPE_LABELS[type]}
          </button>
        `
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'type-pills': TypePills;
  }
}
