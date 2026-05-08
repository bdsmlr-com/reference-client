import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { Tag } from '../types/api.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

@customElement('archive-tag-cloud')
export class ArchiveTagCloud extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        margin: 0 auto 14px;
        padding: 0 16px;
        max-width: 900px;
      }

      .teaser {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        padding: 8px 0;
        color: var(--text-muted);
        font-size: 13px;
      }

      .teaser-copy {
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

      .cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 14px;
        align-items: center;
      }

      .tag {
        border: none;
        background: transparent;
        color: var(--text-primary);
        padding: 0;
        line-height: 1.1;
      }

      .tag:hover {
        color: var(--accent);
      }
    `,
  ];

  @property({ type: String }) blogName = '';
  @property({ attribute: false }) tags: Tag[] = [];
  @property({ type: Boolean }) loading = false;
  @state() private open = false;

  private get teaserText(): string {
    const preview = this.tags.slice(0, 7).map((tag) => `#${tag.name}`).join(', ');
    return `@${this.blogName} most used tags ${preview}`;
  }

  private get maxPostsCount(): number {
    return this.tags.reduce((max, tag) => Math.max(max, tag.postsCount || 0), 0);
  }

  private tagFontSize(tag: Tag): string {
    const max = this.maxPostsCount || 1;
    const ratio = (tag.postsCount || 0) / max;
    const size = clamp(14 + ratio * 20, 14, 34);
    return `${Math.round(size)}px`;
  }

  private openModal = (): void => {
    this.open = true;
  };

  private closeModal = (): void => {
    this.open = false;
  };

  private selectTag(tag: string): void {
    this.dispatchEvent(new CustomEvent('tag-select', {
      detail: { tag },
      bubbles: true,
      composed: true,
    }));
    this.closeModal();
  }

  render() {
    if (this.loading || !this.blogName || this.tags.length === 0) {
      return nothing;
    }
    return html`
      <button class="teaser" type="button" @click=${this.openModal}>
        <span class="teaser-copy">${this.teaserText}</span>
        <span class="teaser-action">more...</span>
      </button>
      ${this.open ? html`
        <div class="modal-backdrop" @click=${this.closeModal}>
          <section class="modal" role="dialog" aria-modal="true" aria-label="Archive tag cloud" @click=${(event: Event) => event.stopPropagation()}>
            <div class="modal-header">
              <div>
                <h3 class="modal-title">@${this.blogName} most used tags</h3>
                <div class="modal-subtitle">Pick one tag to replace the current archive filter.</div>
              </div>
              <button class="close-button" type="button" @click=${this.closeModal}>Close</button>
            </div>
            <div class="cloud">
              ${this.tags.map((tag) => html`
                <button
                  class="tag"
                  type="button"
                  style=${`font-size:${this.tagFontSize(tag)}`}
                  title=${`${tag.postsCount || 0} posts`}
                  @click=${() => this.selectTag(tag.name)}
                >
                  #${tag.name}
                </button>
              `)}
            </div>
          </section>
        </div>
      ` : nothing}
    `;
  }
}
