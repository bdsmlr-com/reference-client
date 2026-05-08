import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getGalleryMode, setGalleryMode, type GalleryMode } from '../services/profile.js';

@customElement('gallery-mode-picker')
export class GalleryModePicker extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
        position: relative;
        min-width: 0;
      }

      .selector {
        position: relative;
        display: inline-flex;
      }

      .trigger {
        display: inline-flex;
        align-items: center;
        min-height: 36px;
        padding: 0 14px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
      }

      .trigger:hover {
        background: var(--border-strong);
      }

      .trigger.active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .popover {
        position: absolute;
        top: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        width: min(92vw, 280px);
        padding: 12px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--surface-raised, var(--surface-primary, #fff));
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.12);
        z-index: 30;
      }

      .pill-group {
        display: flex;
        gap: 6px;
        justify-content: center;
        flex-wrap: wrap;
      }

      .mode-pill {
        min-height: 28px;
        padding: 6px 12px;
        border-radius: 999px;
        background: var(--bg-panel-alt);
        color: var(--text-muted);
        font-size: 12px;
      }

      .mode-pill:hover {
        background: var(--border-strong);
      }

      .mode-pill.active {
        background: var(--accent);
        color: #fff;
      }
    `,
  ];

  @property({ type: String }) value: GalleryMode = 'grid';
  @property({ type: String }) pageName = '';
  @property({ type: Boolean }) persistSelection = true;

  @state() private open = false;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('click', this.handleWindowClick);
    if (this.persistSelection) {
      this.value = getGalleryMode(this.pageName || undefined);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('click', this.handleWindowClick);
  }

  private handleWindowClick = (event: Event): void => {
    if (!this.open) return;
    const path = event.composedPath();
    if (!path.includes(this)) {
      this.open = false;
    }
  };

  private toggleSelector(event: Event): void {
    event.stopPropagation();
    this.open = !this.open;
  }

  private setMode(mode: GalleryMode): void {
    this.value = mode;
    if (this.persistSelection) {
      setGalleryMode(mode, this.pageName || undefined);
    }
    this.dispatchEvent(new CustomEvent('gallery-mode-change', {
      detail: { value: mode },
      bubbles: true,
      composed: true,
    }));
    this.open = false;
  }

  private summary(): string {
    return this.value === 'masonry' ? 'Masonry' : 'Grid';
  }

  render() {
    return html`
      <div class="selector">
        <button
          type="button"
          class="trigger ${this.open || this.value !== 'grid' ? 'active' : ''}"
          @click=${this.toggleSelector}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-label=${`Choose gallery mode: ${this.summary()}`}
        >
          ${this.summary()}
        </button>
        ${this.open ? html`
          <div class="popover" role="dialog" aria-label="Choose gallery mode" @click=${(event: Event) => event.stopPropagation()}>
            <div class="pill-group">
              <button
                type="button"
                class="mode-pill ${this.value === 'grid' ? 'active' : ''}"
                @click=${() => this.setMode('grid')}
              >Grid</button>
              <button
                type="button"
                class="mode-pill ${this.value === 'masonry' ? 'active' : ''}"
                @click=${() => this.setMode('masonry')}
              >Masonry</button>
            </div>
          </div>
        ` : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gallery-mode-picker': GalleryModePicker;
  }
}
