import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { EventNames } from '../types/events.js';
import { SPACING, CONTAINER_SPACING, AUTO_RETRY } from '../types/ui-constants.js';

/**
 * Error state component with optional auto-retry functionality (TOUT-001).
 *
 * Features:
 * - Displays error message with optional retry button
 * - Optional auto-retry with exponential backoff after timeouts/errors
 * - Shows countdown timer during auto-retry
 * - User can cancel auto-retry or retry immediately
 * - Auto-retry stops after max attempts
 *
 * Usage:
 * ```html
 * <!-- Basic error state with manual retry -->
 * <error-state title="Error" message="Something went wrong"></error-state>
 *
 * <!-- With auto-retry enabled (for timeout/retryable errors) -->
 * <error-state title="Timeout" message="Request timed out" autoRetry></error-state>
 * ```
 */
@customElement('error-state')
export class ErrorState extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        text-align: center;
        /* UIC-021: Use standardized spacing scale */
        padding: ${SPACING.XXL}px ${CONTAINER_SPACING.HORIZONTAL}px;
      }

      .error-icon {
        font-size: 48px;
        /* UIC-021: Use standardized spacing scale */
        margin-bottom: ${SPACING.MD}px;
      }

      .error-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        /* UIC-021: Use standardized spacing scale */
        margin-bottom: ${SPACING.SM}px;
      }

      .error-message {
        font-size: 14px;
        color: var(--text-muted);
        margin-bottom: 20px;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      }

      .button-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: ${SPACING.SM}px;
      }

      .retry-btn {
        /* UIC-021: Use standardized spacing scale */
        padding: ${SPACING.MD}px ${SPACING.XL}px;
        border-radius: 6px;
        background: var(--accent);
        color: white;
        font-size: 14px;
        min-height: 44px;
        transition: background 0.2s;
      }

      .retry-btn:hover {
        background: var(--accent-hover);
      }

      .retry-btn:disabled {
        background: var(--text-muted);
        cursor: wait;
      }

      .countdown-info {
        font-size: 13px;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: ${SPACING.SM}px;
      }

      .countdown-timer {
        font-variant-numeric: tabular-nums;
        font-weight: 500;
        color: var(--accent);
      }

      .cancel-link {
        color: var(--text-muted);
        text-decoration: underline;
        cursor: pointer;
        font-size: 13px;
        background: none;
        border: none;
        padding: 0;
      }

      .cancel-link:hover {
        color: var(--text-primary);
      }

      .attempt-info {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: ${SPACING.XS}px;
      }
    `,
  ];

  @property({ type: String }) title = 'Something went wrong';
  @property({ type: String }) message = '';
  @property({ type: Boolean }) showRetry = true;
  @property({ type: Boolean }) retrying = false;
  /** Enable auto-retry with exponential backoff (TOUT-001) */
  @property({ type: Boolean }) autoRetry = false;
  /** Current auto-retry attempt number (starts at 0) */
  @property({ type: Number }) autoRetryAttempt = 0;

  @state() private countdownSeconds = 0;
  @state() private autoRetryPending = false;
  @state() private autoRetryCancelled = false;

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    // Start auto-retry countdown if enabled and we have attempts left
    if (this.autoRetry && this.autoRetryAttempt < AUTO_RETRY.MAX_ATTEMPTS) {
      this.startAutoRetry();
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearTimers();
  }

  updated(changedProperties: Map<string, unknown>): void {
    // If auto-retry is newly enabled or attempt changed, start countdown
    if (
      changedProperties.has('autoRetry') ||
      changedProperties.has('autoRetryAttempt')
    ) {
      if (this.autoRetry && this.autoRetryAttempt < AUTO_RETRY.MAX_ATTEMPTS && !this.autoRetryPending && !this.autoRetryCancelled) {
        this.startAutoRetry();
      }
    }
  }

  private clearTimers(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private calculateDelay(): number {
    // Exponential backoff: initial * (multiplier ^ attempt)
    // e.g., 5s, 10s, 20s (capped at max)
    const delay = AUTO_RETRY.INITIAL_DELAY_MS * Math.pow(AUTO_RETRY.BACKOFF_MULTIPLIER, this.autoRetryAttempt);
    return Math.min(delay, AUTO_RETRY.MAX_DELAY_MS);
  }

  private startAutoRetry(): void {
    this.clearTimers();
    this.autoRetryPending = true;
    this.autoRetryCancelled = false;

    const delayMs = this.calculateDelay();
    this.countdownSeconds = Math.ceil(delayMs / 1000);

    // Update countdown every second
    this.countdownTimer = setInterval(() => {
      this.countdownSeconds--;
      if (this.countdownSeconds <= 0) {
        this.clearTimers();
        this.executeAutoRetry();
      }
    }, AUTO_RETRY.COUNTDOWN_INTERVAL_MS);

    // Backup timer in case countdown misses
    this.retryTimer = setTimeout(() => {
      this.clearTimers();
      this.executeAutoRetry();
    }, delayMs);
  }

  private executeAutoRetry(): void {
    this.autoRetryPending = false;
    // Dispatch retry event - parent component handles the actual retry
    // and will increment autoRetryAttempt on the next error if retry fails
    this.dispatchEvent(new CustomEvent(EventNames.RETRY, {
      detail: { isAutoRetry: true, attempt: this.autoRetryAttempt }
    }));
  }

  private handleRetry(): void {
    this.clearTimers();
    this.autoRetryPending = false;
    this.autoRetryCancelled = true;
    // Manual retry - dispatch event to parent
    this.dispatchEvent(new CustomEvent(EventNames.RETRY, {
      detail: { isAutoRetry: false, attempt: this.autoRetryAttempt }
    }));
  }

  private handleCancelAutoRetry(): void {
    this.clearTimers();
    this.autoRetryPending = false;
    this.autoRetryCancelled = true;
    this.countdownSeconds = 0;
  }

  /** Reset auto-retry state (call when error is resolved or new error occurs) */
  public resetAutoRetry(): void {
    this.clearTimers();
    this.autoRetryPending = false;
    this.autoRetryCancelled = false;
    this.countdownSeconds = 0;
  }

  render() {
    const hasAttemptsLeft = this.autoRetryAttempt < AUTO_RETRY.MAX_ATTEMPTS;
    const showAutoRetryInfo = this.autoRetry && this.autoRetryPending && this.countdownSeconds > 0;
    const showMaxAttemptsReached = this.autoRetry && !hasAttemptsLeft && !this.retrying;

    return html`
      <aside role="alert" aria-live="assertive">
        <div class="error-icon" aria-hidden="true">⚠️</div>
        <h2 class="error-title">${this.title}</h2>
        ${this.message ? html`<p class="error-message">${this.message}</p>` : nothing}
        ${this.showRetry
          ? html`
              <div class="button-container">
                <button
                  class="retry-btn"
                  @click=${this.handleRetry}
                  ?disabled=${this.retrying}
                  aria-busy=${this.retrying ? 'true' : 'false'}
                  aria-label=${this.retrying ? 'Retrying request' : 'Retry failed request'}
                >
                  ${this.retrying ? 'Retrying...' : showAutoRetryInfo ? 'Retry Now' : 'Try Again'}
                </button>

                ${showAutoRetryInfo
                  ? html`
                      <div class="countdown-info">
                        <span>Auto-retry in <span class="countdown-timer">${this.countdownSeconds}s</span></span>
                        <button
                          class="cancel-link"
                          @click=${this.handleCancelAutoRetry}
                          aria-label="Cancel auto-retry"
                        >
                          Cancel
                        </button>
                      </div>
                    `
                  : nothing}

                ${showMaxAttemptsReached
                  ? html`
                      <div class="attempt-info">
                        Auto-retry limit reached. Please try again manually.
                      </div>
                    `
                  : nothing}
              </div>
            `
          : nothing}
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'error-state': ErrorState;
  }
}
