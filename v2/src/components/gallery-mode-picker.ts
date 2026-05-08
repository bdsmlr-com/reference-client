import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getGalleryMode, setGalleryMode, type GalleryMode } from '../services/profile.js';
import { SelectorPopoverController, selectorPopoverStyles } from './selector-popover.js';

@customElement('gallery-mode-picker')
export class GalleryModePicker extends LitElement {
  static styles = [
    baseStyles,
    selectorPopoverStyles,
    css`
      .popover {
        width: min(92vw, 280px);
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
  private selectorPopover = new SelectorPopoverController(this, () => this.open, (next) => { this.open = next; });

  connectedCallback(): void {
    super.connectedCallback();
    this.selectorPopover.connect();
    if (this.persistSelection) {
      this.value = getGalleryMode(this.pageName || undefined);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.selectorPopover.disconnect();
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
          @click=${this.selectorPopover.toggle}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-label=${`Choose gallery mode: ${this.summary()}`}
        >
          ${this.summary()}
        </button>
        ${this.open ? html`
          <div class="popover" role="dialog" aria-label="Choose gallery mode" @click=${this.selectorPopover.stopPropagation}>
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
