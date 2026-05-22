import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getGalleryMode, normalizeGalleryModeForCapabilities, setGalleryMode, type GalleryMode } from '../services/profile.js';
import { getViewerCapabilities } from '../services/viewer-capabilities.js';
import { EventNames, type GalleryModeLockedDetail } from '../types/events.js';
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

      .mode-pill.locked {
        background: color-mix(in srgb, var(--error) 16%, var(--bg-panel-alt));
        color: color-mix(in srgb, var(--error) 42%, var(--text-primary));
        border: 1px solid color-mix(in srgb, var(--error) 55%, var(--border));
      }

      .mode-pill.locked:hover {
        background: color-mix(in srgb, var(--error) 22%, var(--bg-panel-alt));
      }

      .mode-pill.locked.active {
        background: color-mix(in srgb, var(--error) 78%, var(--bg-panel));
        border-color: color-mix(in srgb, var(--error) 82%, var(--border));
        color: #fff;
      }
    `,
  ];

  @property({ type: String }) value: GalleryMode = 'grid';
  @property({ type: String }) pageName = '';
  @property({ type: Boolean }) persistSelection = true;
  @property({ type: Array }) lockedValues: GalleryMode[] = [];

  @state() private open = false;
  private selectorPopover = new SelectorPopoverController(this, () => this.open, (next) => { this.open = next; });

  connectedCallback(): void {
    super.connectedCallback();
    this.selectorPopover.connect();
    if (this.persistSelection) {
      this.value = normalizeGalleryModeForCapabilities(
        getGalleryMode(this.pageName || undefined),
        getViewerCapabilities(),
      );
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

  private hasLockedValues(): boolean {
    return Array.isArray(this.lockedValues) && this.lockedValues.length > 0;
  }

  private isLocked(mode: GalleryMode): boolean {
    return this.hasLockedValues() && this.lockedValues.includes(mode);
  }

  private handleLockedModeClick(mode: GalleryMode): void {
    this.open = false;
    const label = mode === 'masonry' ? 'Masonry' : 'Grid';
    this.dispatchEvent(new CustomEvent<GalleryModeLockedDetail>(EventNames.GALLERY_MODE_LOCKED, {
      detail: { value: mode, label },
      bubbles: true,
      composed: true,
    }));
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
        ${this.hasLockedValues() ? html`
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
                  class="mode-pill ${this.value === 'masonry' ? 'active' : ''} ${this.isLocked('masonry') ? 'locked' : ''}"
                  @click=${() => (this.isLocked('masonry') ? this.handleLockedModeClick('masonry') : this.setMode('masonry'))}
                  aria-disabled=${this.isLocked('masonry') ? 'true' : 'false'}
                  aria-label=${this.isLocked('masonry') ? 'Masonry locked' : 'Masonry'}
                >Masonry</button>
              </div>
            </div>
          ` : null}
        ` : this.open ? html`
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
