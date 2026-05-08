import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';

@customElement('route-shell-card')
export class RouteShellCard extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: 0 16px;
        margin-bottom: 16px;
      }

      .shell {
        width: min(100%, 900px);
        margin: 0 auto;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        padding: 14px 16px;
        box-sizing: border-box;
      }

      :host([wide]) .shell {
        width: min(100%, 1200px);
      }

      :host([compact]) .shell {
        padding: 10px 12px;
      }
    `,
  ];

  @property({ type: Boolean, reflect: true }) wide = false;
  @property({ type: Boolean, reflect: true }) compact = false;

  render() {
    return html`<section class="shell"><slot></slot></section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'route-shell-card': RouteShellCard;
  }
}
