import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('auth-gate')
export class AuthGate extends LitElement {
  @property({ type: String }) message: string | null = null;
  @property({ type: String }) loginUrl: string = 'https://bdsmlr.com/login';

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0d0d0f;
      color: #fff;
      font-family: sans-serif;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      max-width: 420px;
      width: 100%;
      background: #16161a;
      border: 1px solid #2a2a33;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 0 0 16px; color: #c8c8d0; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    button, a.button {
      appearance: none;
      border: none;
      border-radius: 8px;
      padding: 12px 16px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .primary { background: #ff5c8a; color: #0d0d0f; }
    .secondary { background: #262630; color: #fff; border: 1px solid #333344; }
    .error { color: #ff9fae; margin-bottom: 12px; font-size: 13px; }
  `;

  private handleRetry() {
    this.dispatchEvent(new CustomEvent('auth-retry', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="card">
        <h1>Login required</h1>
        <p>Please log in on bdsmlr.com, then return and click retry.</p>
        ${this.message ? html`<div class="error">${this.message}</div>` : ''}
        <div class="actions">
          <a class="button primary" href=${this.loginUrl} @click=${() => window.location.replace(this.loginUrl)}>Login on bdsmlr.com</a>
          <button class="secondary" @click=${this.handleRetry}>I’ve logged in, retry</button>
        </div>
      </div>
    `;
  }
}
