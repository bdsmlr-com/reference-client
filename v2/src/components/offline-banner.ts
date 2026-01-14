import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import {
  subscribeToConnectionState,
  type ConnectionState,
} from '../services/connection.js';

/**
 * Offline Banner Component
 *
 * Displays a banner at the top of the page when the user is offline.
 * Automatically shows/hides based on connection state.
 * Shows a success message briefly when connection is restored.
 */
@customElement('offline-banner')
export class OfflineBanner extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        position: sticky;
        top: 0;
        z-index: 1000;
      }

      .banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        animation: slideDown 0.3s ease-out;
      }

      .banner--offline {
        background: #fbbf24;
        color: #78350f;
      }

      .banner--online {
        background: #22c55e;
        color: #fff;
      }

      .banner__icon {
        font-size: 16px;
      }

      .banner__text {
        flex: 1;
        max-width: 600px;
      }

      @keyframes slideDown {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @keyframes slideUp {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(-100%);
          opacity: 0;
        }
      }

      .banner--hiding {
        animation: slideUp 0.3s ease-out forwards;
      }
    `,
  ];

  @state() private connectionState: ConnectionState = 'online';
  @state() private showReconnected = false;
  @state() private isHiding = false;
  @state() private wasOffline = false;

  private unsubscribe: (() => void) | null = null;
  private reconnectedTimeout: ReturnType<typeof setTimeout> | null = null;

  connectedCallback(): void {
    super.connectedCallback();

    // Subscribe to connection state changes
    this.unsubscribe = subscribeToConnectionState((state) => {
      // If transitioning from offline to online, show reconnected message
      if (this.connectionState === 'offline' && state === 'online') {
        this.wasOffline = true;
        this.showReconnected = true;

        // Hide the reconnected message after 3 seconds
        this.reconnectedTimeout = setTimeout(() => {
          this.isHiding = true;
          // Wait for animation to complete before hiding
          setTimeout(() => {
            this.showReconnected = false;
            this.isHiding = false;
            this.wasOffline = false;
          }, 300);
        }, 3000);
      }

      // If going offline, clear any pending reconnected timeout
      if (state === 'offline' && this.reconnectedTimeout) {
        clearTimeout(this.reconnectedTimeout);
        this.reconnectedTimeout = null;
        this.showReconnected = false;
        this.isHiding = false;
      }

      this.connectionState = state;
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.reconnectedTimeout) {
      clearTimeout(this.reconnectedTimeout);
      this.reconnectedTimeout = null;
    }
  }

  render() {
    // Show offline banner
    if (this.connectionState === 'offline') {
      return html`
        <div class="banner banner--offline" role="alert">
          <span class="banner__icon">⚠️</span>
          <span class="banner__text">
            You're offline. Some features may be unavailable.
          </span>
        </div>
      `;
    }

    // Show reconnected banner (briefly after coming back online)
    if (this.showReconnected && this.wasOffline) {
      return html`
        <div
          class="banner banner--online ${this.isHiding ? 'banner--hiding' : ''}"
          role="status"
        >
          <span class="banner__icon">✓</span>
          <span class="banner__text">You're back online!</span>
        </div>
      `;
    }

    // Hide banner when online (and not showing reconnected message)
    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'offline-banner': OfflineBanner;
  }
}
