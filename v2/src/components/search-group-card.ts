import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import { extractMedia } from '../types/post.js';
import { toPresentationModel } from '../services/post-presentation.js';
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
        inset: 0 8px auto 8px;
        height: calc(100% - 10px);
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        pointer-events: none;
      }

      .stack::before {
        transform: translateY(-8px) rotate(-1deg);
        opacity: 0.7;
      }

      .stack::after {
        transform: translateY(-4px) rotate(1deg);
        opacity: 0.85;
      }

      .card {
        position: relative;
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--border);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
        cursor: pointer;
      }

      .media {
        aspect-ratio: 1 / 1;
        background: #000;
      }

      .badge {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 2;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.82);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.14);
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 700;
        backdrop-filter: blur(6px);
      }

      .meta {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .title {
        font-size: 13px;
        color: var(--text-primary);
        font-weight: 600;
      }
    `,
  ];

  @property({ type: Object }) post!: ProcessedPost;
  @property({ type: Number }) count = 1;
  @property({ type: String }) label = 'Reblogs';

  private handleClick() {
    this.dispatchEvent(new CustomEvent('activity-click', {
      detail: { post: this.post },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const media = this.post?._media || extractMedia(this.post);
    const rawUrl = media.url || media.videoUrl || media.audioUrl;
    const presentation = toPresentationModel(this.post, { surface: 'card', page: 'search', role: 'cluster' });
    const chip = presentation.identity.chipBlogLabel;

    return html`
      <div class="stack">
        <article class="card" @click=${this.handleClick}>
          <div class="badge">${this.count}</div>
          <div class="media">
            <media-renderer .src=${rawUrl} .type=${'gallery-grid'} style="object-fit: cover;"></media-renderer>
          </div>
          <div class="meta">
            <div class="label">${this.label}</div>
            <div class="title">${chip ? `via ${chip}` : 'Grouped reblogs'}</div>
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
