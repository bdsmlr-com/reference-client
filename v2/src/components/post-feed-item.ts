import { LitElement, html, css, nothing, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import { formatDateShort, getTooltipDate } from '../services/date-formatter.js';
import { EventNames, type PostSelectDetail } from '../types/events.js';
import { MAX_VISIBLE_TAGS, BREAKPOINTS } from '../types/ui-constants.js';

/** Preview text length for full-width feed items */
const PREVIEW_TEXT_LENGTH = 200;

/**
 * Memoization helper: Determines if post property has meaningfully changed.
 * Compares key identifying and display-relevant fields to avoid unnecessary re-renders.
 * Returns true if post should trigger re-render, false if it can be skipped.
 */
function postHasChanged(newVal: ProcessedPost | undefined, oldVal: ProcessedPost | undefined): boolean {
  // If either is undefined, always re-render
  if (!newVal || !oldVal) return true;
  // Same reference - no change
  if (newVal === oldVal) return false;
  // Different post ID - definitely changed
  if (newVal.id !== oldVal.id) return true;
  // Check display-relevant fields that could update
  if (newVal.likesCount !== oldVal.likesCount) return true;
  if (newVal.reblogsCount !== oldVal.reblogsCount) return true;
  if (newVal.commentsCount !== oldVal.commentsCount) return true;
  if (newVal.deletedAtUnix !== oldVal.deletedAtUnix) return true;
  if (newVal.blogName !== oldVal.blogName) return true;
  if (newVal.originBlogName !== oldVal.originBlogName) return true;
  if (newVal.originDeletedAtUnix !== oldVal.originDeletedAtUnix) return true;
  if (newVal.createdAtUnix !== oldVal.createdAtUnix) return true;
  // Check media URL (most visible element)
  if (newVal._media?.url !== oldVal._media?.url) return true;
  if (newVal._media?.type !== oldVal._media?.type) return true;
  // Tags comparison (shallow array check)
  const newTags = newVal.tags || [];
  const oldTags = oldVal.tags || [];
  if (newTags.length !== oldTags.length) return true;
  for (let i = 0; i < Math.min(newTags.length, MAX_VISIBLE_TAGS); i++) {
    if (newTags[i] !== oldTags[i]) return true;
  }
  // No meaningful changes detected
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

      .reblog-indicator a {
        color: var(--accent);
        text-decoration: none;
      }

      .reblog-indicator a:hover {
        text-decoration: underline;
      }

      .post-date {
        font-size: 12px;
        color: var(--text-muted);
      }

      .media-container {
        width: 100%;
        position: relative;
      }

      .media-container img {
        width: 100%;
        max-height: 600px;
        object-fit: contain;
        background: var(--bg-panel-alt);
      }

      .media-container video {
        width: 100%;
        max-height: 600px;
      }

      .type-placeholder {
        width: 100%;
        min-height: 200px;
        background: var(--bg-panel-alt);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        font-size: 16px;
        color: var(--text-muted);
        padding: 24px;
        text-align: center;
      }

      .type-placeholder.text {
        align-items: flex-start;
        justify-content: flex-start;
        font-size: 14px;
        line-height: 1.6;
      }

      .video-container {
        position: relative;
      }

      .video-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 64px;
        color: white;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
        pointer-events: none;
      }

      .card-body {
        padding: 16px;
      }

      .card-stats {
        display: flex;
        gap: 16px;
        font-size: 14px;
        color: var(--text-muted);
        margin-bottom: 12px;
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .tag {
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        padding: 4px 10px;
        border-radius: 14px;
        font-size: 12px;
        border: 1px solid var(--border);
      }

      .tag:hover {
        background: var(--accent);
        color: white;
        border-color: var(--accent);
      }

      .deleted-badge {
        background: var(--error);
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
      }

      /* Mobile: max-width below BREAKPOINTS.MOBILE */
      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE - 1)}px) {
        :host {
          padding: 0 8px;
        }

        .card-header {
          padding: 10px 12px;
        }

        .card-body {
          padding: 12px;
        }
      }
    `,
  ];

  @property({ type: Object, hasChanged: postHasChanged }) post!: ProcessedPost;

  private decodeHtml(htmlStr: string): string {
    const txt = document.createElement('textarea');
    txt.innerHTML = htmlStr;
    return txt.value;
  }

  private handleClick(): void {
    this.dispatchEvent(
      new CustomEvent<PostSelectDetail>(EventNames.POST_SELECT, {
        detail: { post: this.post },
      })
    );
  }

  private handleLinkClick(e: Event): void {
    e.stopPropagation();
  }

  private handleImageError(e: Event): void {
    const img = e.target as HTMLImageElement;
    const src = img.src;

    // Try CDN fallback first (consistent with blog-card.ts and post-card.ts)
    if (src.includes('ocdn012.bdsmlr.com') && !img.dataset.triedFallback) {
      img.dataset.triedFallback = 'true';
      img.src = src.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
      return;
    }

    // If fallback also fails or not applicable, show placeholder
    if (!img.dataset.showedPlaceholder) {
      img.dataset.showedPlaceholder = 'true';
      img.style.display = 'none';
      // Create and insert a placeholder element
      const placeholder = document.createElement('div');
      placeholder.className = 'type-placeholder';
      placeholder.textContent = '🖼️ Image unavailable';
      img.parentElement?.insertBefore(placeholder, img);
    }
  }

  render() {
    const post = this.post;
    const media = post._media;

    const isReblog = post.originPostId && post.originPostId !== post.id;
    const isDeleted = !!post.deletedAtUnix;
    const isOriginDeleted = !!post.originDeletedAtUnix;
    const blogName = (isDeleted ? null : post.blogName) || (isReblog ? 'redacted' : 'unknown');
    const blogUrl = post.blogName && !isDeleted ? `https://${blogName}.bdsmlr.com` : '#';
    const originBlogName = post.originBlogName;
    const originBlogUrl = originBlogName ? `https://${originBlogName}.bdsmlr.com` : '#';

    const tags = post.tags || [];

    let mediaHtml;
    if (media.type === 'image' && media.url) {
      mediaHtml = html`
        <div class="media-container">
          <img src=${media.url} alt="Post ${post.id}" loading="lazy" @error=${this.handleImageError} />
        </div>
      `;
    } else if (media.type === 'video') {
      if (media.url) {
        mediaHtml = html`
          <div class="media-container video-container">
            <img src=${media.url} alt="Post ${post.id}" loading="lazy" @error=${this.handleImageError} />
            <span class="video-icon">▶</span>
          </div>
        `;
      } else {
        mediaHtml = html`<div class="type-placeholder">🎬 Video</div>`;
      }
    } else if (media.type === 'audio') {
      const preview = (media.html || media.text || '').replace(/<[^>]+>/g, '').slice(0, PREVIEW_TEXT_LENGTH);
      mediaHtml = html`<div class="type-placeholder">🔊 Audio<br /><small>${preview}</small></div>`;
    } else if (media.type === 'link') {
      const title = media.title || 'Link';
      if (media.url) {
        mediaHtml = html`
          <div class="media-container">
            <img src=${media.url} alt="Link" loading="lazy" @error=${this.handleImageError} />
          </div>
        `;
      } else {
        mediaHtml = html`<div class="type-placeholder">🔗 ${title}</div>`;
      }
    } else if (media.type === 'chat') {
      const preview = (media.text || media.title || '').replace(/<[^>]+>/g, '').slice(0, PREVIEW_TEXT_LENGTH);
      mediaHtml = html`<div class="type-placeholder text">💬 ${preview || 'Chat'}</div>`;
    } else if (media.type === 'quote') {
      const preview = (media.quoteText || '').replace(/<[^>]+>/g, '').slice(0, PREVIEW_TEXT_LENGTH);
      mediaHtml = html`<div class="type-placeholder text">📜 "${preview || 'Quote'}"</div>`;
    } else if (media.type === 'text') {
      const decoded = this.decodeHtml(media.text || '');
      const preview = decoded.replace(/<[^>]+>/g, '').slice(0, PREVIEW_TEXT_LENGTH);
      mediaHtml = html`<div class="type-placeholder text">📝 ${preview || 'Text'}</div>`;
    } else {
      mediaHtml = html`<div class="type-placeholder">📄 Post</div>`;
    }

    const articleLabel = isDeleted
      ? `Deleted post from ${blogName}`
      : isReblog
        ? `Reblog by ${blogName} from ${originBlogName || 'unknown'}`
        : `Post by ${blogName}`;

    return html`
      <article
        class="card"
        @click=${this.handleClick}
        role="article"
        aria-label=${articleLabel}
        tabindex="0"
        @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.handleClick()}
      >
        <header class="card-header">
          <div class="blog-info">
            <a
              class="blog-name"
              href=${blogUrl}
              target="_blank"
              @click=${this.handleLinkClick}
              aria-label="Visit ${blogName}'s blog"
            >
              @${blogName}
            </a>
            ${isReblog
              ? html`<span class="reblog-indicator" aria-label="Reblogged from ${originBlogName || 'unknown'}"><span aria-hidden="true">♻️</span> ${
                  isOriginDeleted
                    ? html`<span style="opacity: 0.5;">[deleted]</span>`
                    : originBlogName
                      ? html`<a href=${originBlogUrl} target="_blank" @click=${this.handleLinkClick} aria-label="Visit original author ${originBlogName}">@${originBlogName}</a>`
                      : html`<span style="opacity: 0.5;">[unknown]</span>`
                }</span>`
              : nothing}
            ${isDeleted ? html`<span class="deleted-badge" role="status">deleted</span>` : nothing}
          </div>
          ${post.createdAtUnix
            ? html`<time class="post-date" datetime="${new Date(post.createdAtUnix * 1000).toISOString()}" title="${getTooltipDate(post.createdAtUnix)}">${formatDateShort(post.createdAtUnix)}</time>`
            : nothing}
        </header>

        ${mediaHtml}

        <footer class="card-body">
          <div class="card-stats" aria-label="Engagement statistics">
            ${post.likesCount ? html`<span class="stat" aria-label="${post.likesCount} likes"><span aria-hidden="true">❤️</span> ${post.likesCount}</span>` : nothing}
            ${post.reblogsCount ? html`<span class="stat" aria-label="${post.reblogsCount} reblogs"><span aria-hidden="true">♻️</span> ${post.reblogsCount}</span>` : nothing}
            ${post.commentsCount ? html`<span class="stat" aria-label="${post.commentsCount} comments"><span aria-hidden="true">💬</span> ${post.commentsCount}</span>` : nothing}
          </div>
          ${tags.length > 0
            ? html`
                <div class="tags" role="list" aria-label="Tags">
                  ${tags.slice(0, MAX_VISIBLE_TAGS).map((t) => html`<span class="tag" role="listitem">#${t}</span>`)}
                  ${tags.length > MAX_VISIBLE_TAGS ? html`<span class="tag" role="listitem" aria-label="${tags.length - MAX_VISIBLE_TAGS} more tags">+${tags.length - MAX_VISIBLE_TAGS} more</span>` : nothing}
                </div>
              `
            : nothing}
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
