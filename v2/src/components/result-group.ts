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

      .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }

      .header-copy {
        min-width: 0;
        flex: 1;
      }

      .title {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
        color: var(--text-primary);
      }

      .description {
        margin-top: 4px;
        font-size: 13px;
        color: var(--text-muted);
      }

      .action-link {
        flex: 0 0 auto;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 12px;
        border-radius: 999px;
        padding: 6px 10px;
        text-decoration: none;
      }

      .action-link:hover {
        border-color: var(--accent);
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

      :host([wide]) {
        max-width: 1200px;
      }

      :host([bare]) {
        background: transparent;
        border: 0;
        padding: 0;
        border-radius: 0;
      }
    `,
  ];

  @property({ type: String }) label = '';
  @property({ type: String }) title = '';
  @property({ type: String }) description = '';
  @property({ type: String }) actionHref = '';
  @property({ type: Number }) remaining = 0;
  @property({ type: String }) actionLabel = 'Load more';
  @property({ type: Boolean, reflect: true }) wide = false;
  @property({ type: Boolean, reflect: true }) bare = false;

  private handleLoadMore() {
    this.dispatchEvent(new CustomEvent('result-group-load-more', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      ${this.title || this.description || this.actionHref
        ? html`
            <div class="header">
              <div class="header-copy">
                ${this.title ? html`<h3 class="title">${this.title}</h3>` : nothing}
                ${this.description ? html`<div class="description">${this.description}</div>` : nothing}
              </div>
              ${this.actionHref ? html`<a class="action-link" href=${this.actionHref}>${this.actionLabel}</a>` : nothing}
            </div>
          `
        : nothing}
      ${this.label ? html`<div class="label">${this.label}</div>` : nothing}
      <slot></slot>
      ${this.remaining > 0 && !this.actionHref ? html`
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
