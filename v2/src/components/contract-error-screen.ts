import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('contract-error-screen')
export class ContractErrorScreen extends LitElement {
  static styles = css`
    :host { display: block; min-height: 100vh; background: #160b0b; color: #ffd6d6; font-family: monospace; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 12px; font-size: 20px; color: #ff7676; }
    p { margin: 0 0 16px; color: #ffc2c2; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; }
  `;

  @property({ type: Array }) errors: string[] = [];

  render() {
    return html`
      <div class="wrap">
        <h1>Render Contract Error</h1>
        <p>App rendering is blocked because the JSON render contract failed validation.</p>
        <ul>
          ${this.errors.map((e) => html`<li>${e}</li>`)}
        </ul>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'contract-error-screen': ContractErrorScreen;
  }
}
