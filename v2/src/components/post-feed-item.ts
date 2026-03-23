import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { POST_TYPE_ICONS, extractRenderableTags, type ProcessedPost } from '../types/post.js';
import { type PostType } from '../types/api.js';
import { formatDateShort, getTooltipDate } from '../services/date-formatter.js';
import { MAX_VISIBLE_TAGS } from '../types/ui-constants.js';
import { resolveLink } from '../services/link-resolver.js';
import './media-renderer.js';

/**
 * Memoization helper: Determines if post property has meaningfully changed.
 */
function postHasChanged(newVal: ProcessedPost | undefined, oldVal: ProcessedPost | undefined): boolean {
  if (!newVal || !oldVal) return true;
  if (newVal === oldVal) return false;
  if (newVal.id !== oldVal.id) return true;
  if (newVal.likesCount !== oldVal.likesCount) return true;
  if (newVal.reblogsCount !== oldVal.reblogsCount) return true;
  if (newVal.commentsCount !== oldVal.commentsCount) return true;
  if (newVal._media?.url !== oldVal._media?.url) return true;
  return false;
}

@customElement('post-feed-item')
export class PostFeedItem extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 600px;
        margin: 0 auto;
      }

      .card {
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: box-shadow 0.2s;
        border: 1px solid var(--border);
        margin-bottom: 16px;
      }

      .card:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
      }

      .blog-info {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .blog-name {
        font-weight: 600;
        color: var(--text-primary);
        text-decoration: none;
      }

      .blog-name:hover {
        color: var(--accent);
      }

      .reblog-indicator {
        font-size: 12px;
        color: var(--text-muted);
      }

      .post-date {
        font-size: 12px;
        color: var(--text-muted);
      }

      .card-content {
        padding: 16px;
      }

      .media-container {
        width: 100%;
        background: #000;
        line-height: 0;
      }

      .card-body {
        padding: 16px;
        font-size: 14px;
        line-height: 1.5;
        color: var(--text-primary);
      }

      .card-body p:first-child { margin-top: 0; }
      .card-body p:last-child { margin-bottom: 0; }

      .card-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 16px 16px;
      }

      .tag-link {
        font-size: 13px;
        color: var(--accent);
        text-decoration: none;
      }

      .tag-link:hover {
        text-decoration: underline;
      }

      .card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-top: 1px solid var(--border);
        background: var(--bg-panel-alt);
      }

      .card-stats {
        display: flex;
        gap: 16px;
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: var(--text-muted);
      }

      .post-type-icon {
        font-size: 16px;
        opacity: 0.7;
      }

      .link-container {
        padding: 16px;
        background: var(--bg-panel-alt);
        border-radius: 8px;
        margin: 16px;
        border: 1px solid var(--border);
        text-decoration: none;
        display: block;
      }

      .link-title {
        font-weight: 600;
        color: var(--accent);
        margin-bottom: 4px;
      }

      .link-url {
        font-size: 12px;
        color: var(--text-muted);
        word-break: break-all;
      }
    `,
  ];

  @property({ type: Object, hasChanged: postHasChanged }) post!: ProcessedPost;

  private handlePostClick(): void {
    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post: this.post },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const post = this.post;
    const media = post._media;

    const isReblog = post.originPostId && post.originPostId !== post.id;
    const blogName = post.blogName || 'unknown';
    const originBlogName = post.originBlogName || 'unknown';
    const tags = extractRenderableTags(post);
    const blogLink = resolveLink('post_via_blog', { blog: blogName });
    const originBlogLink = resolveLink('post_origin_blog', { blog: originBlogName });
    const rawUrl = media.url || media.videoUrl || media.audioUrl;

    let mediaHtml;
    if (media.type === 'image' || media.type === 'video') {
      if (rawUrl) {
        mediaHtml = html`
          <div class="media-container">
            <media-renderer .src=${rawUrl} .type=${'feed'}></media-renderer>
          </div>
        `;
      }
    }

    return html`
      <article class="card" @click=${this.handlePostClick}>
        <header class="card-header">
          <div class="blog-info">
            ${isReblog ? html`
              <a href=${originBlogLink.href} target=${originBlogLink.target} rel=${originBlogLink.rel || nothing} class="blog-name" @click=${(e: Event) => e.stopPropagation()}>@${originBlogName}</a>
              <span class="reblog-indicator">
                ♻️ via <a href=${blogLink.href} target=${blogLink.target} rel=${blogLink.rel || nothing} class="blog-name" @click=${(e: Event) => e.stopPropagation()}>@${blogName}</a>
              </span>
            ` : html`
              <a href=${blogLink.href} target=${blogLink.target} rel=${blogLink.rel || nothing} class="blog-name" @click=${(e: Event) => e.stopPropagation()}>@${blogName}</a>
            `}
          </div>
          <time class="post-date" title=${getTooltipDate(post.createdAtUnix)}>${formatDateShort(post.createdAtUnix)}</time>
        </header>

        ${mediaHtml}

        ${post.body ? html`<div class="card-body">${post.body}</div>` : ''}

        ${tags.length > 0 ? html`
          <div class="card-tags">
            ${tags.slice(0, MAX_VISIBLE_TAGS).map(tag => html`
              <a href=${resolveLink('search_tag', { tag }).href} class="tag-link" @click=${(e: Event) => e.stopPropagation()}>#${tag}</a>
            `)}
          </div>
        ` : ''}

        <footer class="card-footer">
          <div class="card-stats">
            ${post.likesCount ? html`<span class="stat">❤️ ${post.likesCount}</span>` : ''}
            ${post.reblogsCount ? html`<span class="stat">♻️ ${post.reblogsCount}</span>` : ''}
            ${post.commentsCount ? html`<span class="stat">💬 ${post.commentsCount}</span>` : ''}
          </div>
          <div class="post-type-icon">${POST_TYPE_ICONS[post.type as PostType] || '📄'}</div>
        </footer>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-feed-item': PostFeedItem;
  }
}
