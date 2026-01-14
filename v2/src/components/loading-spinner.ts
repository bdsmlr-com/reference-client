import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { REQUEST_TIMING, SPACING, CONTAINER_SPACING } from '../types/ui-constants.js';

@customElement('loading-spinner')
export class LoadingSpinner extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        /* UIC-021: Use standardized spacing scale */
        padding: ${SPACING.XXL}px ${CONTAINER_SPACING.HORIZONTAL}px;
        gap: ${SPACING.MD}px;
      }

      :host([inline]) {
        display: inline-flex;
        padding: 0;
        gap: 0;
      }

      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      :host([size="small"]) .spinner {
        width: 20px;
        height: 20px;
        border-width: 2px;
      }

      :host([size="tiny"]) .spinner {
        width: 12px;
        height: 12px;
        border-width: 2px;
      }

      :host([size="large"]) .spinner {
        width: 48px;
        height: 48px;
        border-width: 4px;
      }

      .message {
        font-size: 14px;
        color: var(--text-muted);
      }

      .slow-indicator {
        font-size: 12px;
        color: var(--text-muted);
        /* UIC-021: Use standardized spacing scale */
        margin-top: ${SPACING.XS}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        animation: fadeIn 0.3s ease-in;
      }

      .slow-message {
        color: var(--accent);
        font-weight: 500;
      }

      .elapsed-time {
        font-variant-numeric: tabular-nums;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `,
  ];

  @property({ type: String }) message = '';
  @property({ type: String, reflect: true }) size: 'tiny' | 'small' | 'medium' | 'large' = 'medium';
  @property({ type: Boolean, reflect: true }) inline = false;
  /** Enable elapsed time tracking and slow request indicator (TOUT-002) */
  @property({ type: Boolean }) trackTime = false;

  @state() private elapsedSeconds = 0;
  @state() private isSlowRequest = false;

  private startTime: number | null = null;
  private timerInterval: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.trackTime) {
      this.startTimer();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTimer();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('trackTime')) {
      if (this.trackTime) {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }
  }

  private startTimer(): void {
    if (this.timerInterval !== null) return;

    this.startTime = Date.now();
    this.elapsedSeconds = 0;
    this.isSlowRequest = false;

    this.timerInterval = window.setInterval(() => {
      if (this.startTime === null) return;

      const elapsed = Date.now() - this.startTime;
      this.elapsedSeconds = Math.floor(elapsed / 1000);

      // Mark as slow request after threshold
      if (elapsed >= REQUEST_TIMING.SLOW_THRESHOLD_MS && !this.isSlowRequest) {
        this.isSlowRequest = true;
      }
    }, REQUEST_TIMING.ELAPSED_UPDATE_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.startTime = null;
    this.elapsedSeconds = 0;
    this.isSlowRequest = false;
  }

  /** Reset the timer (call when starting a new request) */
  resetTimer(): void {
    this.stopTimer();
    if (this.trackTime) {
      this.startTimer();
    }
  }

  private formatElapsedTime(): string {
    const elapsed = this.elapsedSeconds;
    if (elapsed >= REQUEST_TIMING.MAX_ELAPSED_DISPLAY_MS / 1000) {
      return 'still working...';
    }
    if (elapsed >= 60) {
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${elapsed}s`;
  }

  render() {
    const showSlowIndicator = this.trackTime && this.isSlowRequest && !this.inline;

    return html`
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label=${this.message || 'Loading'}
      >
        <div class="spinner" aria-hidden="true"></div>
        ${this.message ? html`<div class="message">${this.message}</div>` : ''}
        ${showSlowIndicator
          ? html`
              <div class="slow-indicator" aria-live="polite">
                <span class="slow-message">Taking longer than expected...</span>
                <span class="elapsed-time">${this.formatElapsedTime()}</span>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'loading-spinner': LoadingSpinner;
  }
}
