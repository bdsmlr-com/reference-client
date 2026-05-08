import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import { extractMedia } from '../types/post.js';
import './media-renderer.js';

@customElement('search-group-card')
export class SearchGroupCard extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .stack {
        position: relative;
        padding-top: 10px;
      }

      .stack::before,
      .stack::after {
        content: '';
        position: absolute;
        left: 8px;
        right: 8px;
        top: 0;
        bottom: 6px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        pointer-events: none;
        z-index: 0;
      }

      .stack::before {
        transform: translateY(-8px) rotate(-1deg);
        opacity: 0.7;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14);
      }

      .stack::after {
        transform: translateY(-4px) rotate(1deg);
        opacity: 0.85;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
      }

      .card {
        position: relative;
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
        cursor: pointer;
        z-index: 1;
      }

      .media {
        aspect-ratio: 1 / 1;
        background: #000;
      }

      :host([mode='masonry']) .media {
        aspect-ratio: auto;
      }

      .meta {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .label {
        font-size: 13px;
        color: var(--text-primary);
        font-weight: 600;
      }
    `,
  ];

  @property({ type: Object }) post!: ProcessedPost;
  @property({ type: Number }) count = 1;
  @property({ type: String }) label = 'Reblogs';
  @property({ type: Number }) originPostId = 0;
  @property({ type: String, reflect: true }) mode: 'grid' | 'masonry' = 'grid';

  private handleClick() {
    if (this.originPostId > 0) {
      window.location.href = `/post/${this.originPostId}`;
    }
  }

  render() {
    const media = this.post?._media || extractMedia(this.post);
    const rawUrl = media.url || media.videoUrl || media.audioUrl;
    const reblogCount = this.post.reblogsCount ?? this.count;
    const originLabel = this.post.originBlogName
      ? `@${this.post.originBlogName}`
      : (this.post.blogName ? `@${this.post.blogName}` : 'Unknown');

    return html`
      <div class="stack">
        <article class="card" @click=${this.handleClick}>
          <div class="media">
            <media-renderer
              .src=${rawUrl}
              .type=${this.mode === 'masonry' ? 'masonry' : 'card'}
              style="object-fit: ${this.mode === 'masonry' ? 'contain' : 'cover'};"
            ></media-renderer>
          </div>
          <div class="meta">
            <div class="label">♻️ ${reblogCount} ${originLabel}</div>
          </div>
        </article>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'search-group-card': SearchGroupCard;
  }
}
