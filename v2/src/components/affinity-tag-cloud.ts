import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { BlogTagAffinity, Tag } from '../types/api.js';
import { buildArchiveTagLayout, type PositionedArchiveTag } from '../services/archive-tag-layout.js';
import { selectAffinityBucket, type AffinityHorizon, type AffinityInteractionMode } from '../services/tag-affinity.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

@customElement('affinity-tag-cloud')
export class AffinityTagCloud extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-width: 0;
      }

      .teaser {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-width: 0;
        padding: 8px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text-primary);
        font-size: 13px;
        text-align: left;
      }

      .teaser:hover {
        background: var(--bg-panel-alt);
      }

      .teaser.error {
        justify-content: flex-start;
        color: var(--text-muted);
        border-style: dashed;
        cursor: default;
      }

      .teaser-copy {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .teaser-action {
        flex: 0 0 auto;
        color: var(--accent);
        font-weight: 600;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2100;
        padding: 16px;
      }

      .modal {
        width: min(860px, 100%);
        max-height: min(80vh, 900px);
        overflow: auto;
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .modal-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      .modal-title {
        margin: 0;
        color: var(--text-primary);
        font-size: 18px;
      }

      .modal-subtitle {
        color: var(--text-muted);
        font-size: 13px;
      }

      .close-button {
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        min-height: 36px;
        padding: 0 14px;
      }

      .controls {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .chip-group {
        display: grid;
        gap: 8px;
      }

      .chip-label {
        color: var(--text-muted);
        font-size: 11px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .chip {
        min-height: 34px;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 13px;
      }

      .chip[aria-checked='true'] {
        background: color-mix(in srgb, var(--accent) 14%, var(--bg-panel));
        border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
        color: var(--text-primary);
      }

      .cloud {
        position: relative;
        width: 100%;
        min-height: 240px;
      }

      .tag {
        border: none;
        background: transparent;
        color: var(--text-primary);
        padding: 0;
        line-height: 1.1;
        white-space: nowrap;
      }

      .tag:hover {
        color: var(--accent);
      }

      .tag-slot {
        position: absolute;
      }

      .tag-anchor {
        position: absolute;
        left: 50%;
        top: 50%;
        transform-origin: center center;
      }

      .empty {
        color: var(--text-muted);
        font-size: 14px;
        text-align: center;
        padding: 28px 12px;
      }

      @media (max-width: 720px) {
        .controls {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  @property({ type: String }) title = 'Affinity Tags';
  @property({ type: String }) subtitle = '';
  @property({ type: String }) blogName = '';
  @property({ attribute: false }) tagAffinity: BlogTagAffinity | null = null;
  @property({ type: Boolean }) loading = false;
  @property({ type: String }) error = '';
  @property({ type: Boolean }) showControls = false;
  @property({ type: String }) interactionMode: 'both' | 'likes' | 'reblogs' = 'both';
  @property({ type: String }) horizon: 'recent' | 'all' = 'recent';
  @state() private open = false;
  @state() private positionedTags: PositionedArchiveTag[] = [];
  @state() private cloudHeight = 0;
  private resizeObserver: ResizeObserver | null = null;
  private measureCanvas: HTMLCanvasElement | null = null;

  private get currentTags(): Tag[] {
    return selectAffinityBucket(this.tagAffinity, this.horizon as AffinityHorizon, this.interactionMode as AffinityInteractionMode);
  }

  private get teaserText(): string {
    const preview = this.currentTags.slice(0, 7).map((tag) => `#${tag.name}`).join(', ');
    return preview
      ? `@${this.blogName} ${this.title.toLowerCase()} ${preview}`
      : `${this.title} for @${this.blogName}`;
  }

  private get maxPostsCount(): number {
    return this.currentTags.reduce((max, tag) => Math.max(max, tag.postsCount || 0), 0);
  }

  private tagFontSize(tag: Tag): number {
    const max = this.maxPostsCount || 1;
    const ratio = (tag.postsCount || 0) / max;
    return Math.round(clamp(14 + ratio * 20, 14, 34));
  }

  private openModal = (): void => {
    this.open = true;
    requestAnimationFrame(() => this.recomputeLayout());
  };

  private closeModal = (): void => {
    this.open = false;
    this.positionedTags = [];
    this.cloudHeight = 0;
  };

  private selectTag(tag: string): void {
    this.dispatchEvent(new CustomEvent('tag-select', {
      detail: { tag },
      bubbles: true,
      composed: true,
    }));
    this.closeModal();
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.recomputeLayout);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.recomputeLayout);
    this.resizeObserver?.disconnect();
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('open') && this.open) {
      requestAnimationFrame(() => {
        this.observeCloudStage();
        this.recomputeLayout();
      });
    }
    if ((changed.has('tagAffinity') || changed.has('interactionMode') || changed.has('horizon')) && this.open) {
      requestAnimationFrame(() => this.recomputeLayout());
    }
  }

  private observeCloudStage(): void {
    const stage = this.shadowRoot?.querySelector<HTMLElement>('.cloud');
    if (!stage || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.recomputeLayout());
    this.resizeObserver.observe(stage);
  }

  private getMeasureContext(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') {
      return null;
    }
    if (!this.measureCanvas) {
      this.measureCanvas = document.createElement('canvas');
    }
    return this.measureCanvas.getContext('2d');
  }

  private recomputeLayout = (): void => {
    if (!this.open) return;
    const stage = this.shadowRoot?.querySelector<HTMLElement>('.cloud');
    if (!stage) return;
    const width = Math.max(320, Math.floor(stage.clientWidth));
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const maxHeight = Math.max(280, Math.floor(viewportHeight * 0.58));
    const context = this.getMeasureContext();
    const measured = this.currentTags.map((tag) => {
      const fontSize = this.tagFontSize(tag);
      const label = `#${tag.name}`;
      const widthEstimate = context
        ? (() => {
            context.font = `600 ${fontSize}px system-ui, sans-serif`;
            return Math.ceil(context.measureText(label).width);
          })()
        : label.length * fontSize * 0.62;
      return {
        ...tag,
        fontSize,
        width: widthEstimate,
        height: Math.ceil(fontSize * 1.1),
      };
    });
    const layout = buildArchiveTagLayout(measured, {
      width,
      maxHeight,
      gap: 8,
    });
    this.positionedTags = layout.items;
    this.cloudHeight = layout.height;
  };

  private updateInteractionMode(mode: AffinityInteractionMode): void {
    if (this.interactionMode === mode) return;
    this.interactionMode = mode;
    this.dispatchEvent(new CustomEvent('interaction-mode-change', {
      detail: { value: mode },
      bubbles: true,
      composed: true,
    }));
  }

  private updateHorizon(horizon: AffinityHorizon): void {
    if (this.horizon === horizon) return;
    this.horizon = horizon;
    this.dispatchEvent(new CustomEvent('horizon-change', {
      detail: { value: horizon },
      bubbles: true,
      composed: true,
    }));
  }

  private renderChipGroup(label: string, options: readonly string[], selectedValue: string, onSelect: (value: string) => void) {
    return html`
      <div class="chip-group">
        <div class="chip-label">${label}</div>
        <div class="chip-row" role="radiogroup" aria-label=${label}>
          ${options.map((option) => {
            const selected = option === selectedValue;
            const rendered = option === 'both' ? 'Both' : option === 'likes' ? 'Likes' : option === 'reblogs' ? 'Reblogs' : option === 'recent' ? 'Recent' : 'All';
            return html`
              <button
                class="chip"
                type="button"
                role="radio"
                aria-checked=${selected}
                @click=${() => onSelect(option)}
              >${rendered}</button>
            `;
          })}
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`<button class="teaser error" type="button" disabled><span class="teaser-copy">Loading ${this.title.toLowerCase()}…</span></button>`;
    }

    if (this.error) {
      return html`<div class="teaser error">${this.error}</div>`;
    }

    if (this.currentTags.length === 0) {
      return html`<div class="teaser error">No ${this.title.toLowerCase()} available.</div>`;
    }

    return html`
      <button class="teaser" type="button" @click=${this.openModal}>
        <span class="teaser-copy">${this.teaserText}</span>
        <span class="teaser-action">Explore</span>
      </button>

      ${this.open ? html`
        <div class="modal-backdrop" @click=${this.closeModal}>
          <section class="modal" role="dialog" aria-modal="true" aria-label=${this.title} @click=${(event: Event) => event.stopPropagation()}>
            <div class="modal-header">
              <div>
                <h3 class="modal-title">${this.title}</h3>
                ${this.subtitle ? html`<div class="modal-subtitle">${this.subtitle}</div>` : nothing}
              </div>
              <button class="close-button" type="button" @click=${this.closeModal}>Close</button>
            </div>

            ${this.showControls ? html`
              <div class="controls">
                ${this.renderChipGroup('Interaction', ['both', 'likes', 'reblogs'], this.interactionMode, (value) => this.updateInteractionMode(value as AffinityInteractionMode))}
                ${this.renderChipGroup('Window', ['recent', 'all'], this.horizon, (value) => this.updateHorizon(value as AffinityHorizon))}
              </div>
            ` : nothing}

            ${this.currentTags.length === 0
              ? html`<div class="empty">No tags available for this view yet.</div>`
              : html`
                  <div class="cloud" style=${`height:${Math.max(this.cloudHeight, 240)}px`}>
                    ${this.positionedTags.map((tag) => html`
                      <div
                        class="tag-slot"
                        style=${`left:${tag.left}px;top:${tag.top}px;width:${tag.boxWidth}px;height:${tag.boxHeight}px;`}
                      >
                        <button
                          class="tag tag-anchor"
                          type="button"
                          style=${[
                            `font-size:${tag.fontSize}px`,
                            `width:${tag.width}px`,
                            `height:${tag.height}px`,
                            `margin-left:${-tag.width / 2}px`,
                            `margin-top:${-tag.height / 2}px`,
                            `transform:${tag.rotated ? 'rotate(90deg)' : 'none'}`,
                          ].join(';')}
                          title=${`${tag.postsCount || 0} posts`}
                          @click=${() => this.selectTag(tag.name)}
                        >
                          #${tag.name}
                        </button>
                      </div>
                    `)}
                  </div>
                `}
          </section>
        </div>
      ` : nothing}
    `;
  }
}
