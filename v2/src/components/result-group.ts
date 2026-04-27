import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';

@customElement('result-group')
export class ResultGroup extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 600px;
        margin: 0 auto 20px auto;
        background: var(--bg-panel-alt);
        padding: 12px;
        border-radius: 8px;
        border: 1px solid var(--border);
      }

      .label {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 8px;
        font-weight: 600;
      }

      .actions {
        margin-top: 8px;
        display: flex;
        justify-content: center;
      }

      .load-more {
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text);
        font-size: 12px;
        border-radius: 999px;
        padding: 4px 10px;
        cursor: pointer;
      }

      .load-more:hover {
        border-color: var(--accent);
      }
    `,
  ];

  @property({ type: String }) label = '';
  @property({ type: Number }) remaining = 0;
  @property({ type: String }) actionLabel = 'Load more';

  private handleLoadMore() {
    this.dispatchEvent(new CustomEvent('result-group-load-more', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      ${this.label ? html`<div class="label">${this.label}</div>` : nothing}
      <slot></slot>
      ${this.remaining > 0 ? html`
        <div class="actions">
          <button class="load-more" type="button" @click=${this.handleLoadMore}>${this.actionLabel} (${this.remaining})</button>
        </div>
      ` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'result-group': ResultGroup;
  }
}
