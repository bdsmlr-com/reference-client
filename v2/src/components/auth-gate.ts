import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { login } from '../services/auth-service.js';

@customElement('auth-gate')
export class AuthGate extends LitElement {
  @property({ type: String }) message: string | null = null;
  @property({ type: String }) loginUrl: string = 'https://bdsmlr.com/login';
  @state() private username = '';
  @state() private password = '';
  @state() private busy = false;

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
    .input {
      width: 100%;
      min-height: 38px;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #2d2d36;
      background: #0f0f13;
      color: #fff;
      box-sizing: border-box;
    }
  `;

  private handleRetry() {
    this.dispatchEvent(new CustomEvent('auth-retry', { bubbles: true, composed: true }));
  }

  private async handleLoginSubmit(e: Event) {
    e.preventDefault();
    const u = this.username.trim();
    const p = this.password;
    if (!u || !p) {
      this.message = 'Enter username and password';
      return;
    }
    this.busy = true;
    this.message = null;
    try {
      await login(u, p, true);
      this.dispatchEvent(new CustomEvent('auth-retry', { bubbles: true, composed: true }));
    } catch (err: any) {
      this.message = 'Login failed';
    } finally {
      this.busy = false;
    }
  }

  render() {
    return html`
      <div class="card">
        <h1>Login required</h1>
        <p>Log in below or use the legacy login link. After logging in, click retry.</p>
        ${this.message ? html`<div class="error">${this.message}</div>` : ''}
        <form @submit=${this.handleLoginSubmit} style="display:flex; flex-direction:column; gap:10px; margin-bottom:12px;">
          <input class="input" type="text" placeholder="username or email" .value=${this.username} @input=${(e: Event) => this.username = (e.target as HTMLInputElement).value} />
          <input class="input" type="password" placeholder="password" .value=${this.password} @input=${(e: Event) => this.password = (e.target as HTMLInputElement).value} />
          <button class="primary" type="submit" ?disabled=${this.busy}>Log in</button>
        </form>
        <div class="actions">
          <a class="button secondary" href=${this.loginUrl} @click=${() => window.location.replace(this.loginUrl)}>Legacy login</a>
          <button class="secondary" @click=${this.handleRetry}>Retry status</button>
        </div>
      </div>
    `;
  }
}
