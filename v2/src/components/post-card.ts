import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import { EventNames, type PostSelectDetail } from '../types/events.js';
import { MAX_VISIBLE_TAGS } from '../types/ui-constants.js';

/** Preview text length for grid cards (compact view) */
const PREVIEW_TEXT_LENGTH = 80;

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

@customElement('post-card')
export class PostCard extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .card {
        background: var(--bg-panel);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
        border: 1px solid var(--border);
      }

      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }

      .ghost {
        background: linear-gradient(
          90deg,
          var(--bg-panel-alt) 25%,
          var(--border) 50%,
          var(--bg-panel-alt) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 2s infinite linear;
      }

      .error-ghost {
        background: var(--bg-panel-alt);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        gap: 8px;
        width: 100%;
        min-height: 200px;
        border-radius: 4px;
      }

      .error-icon {
        font-size: 24px;
        opacity: 0.5;
      }

      .multi-image-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
        z-index: 2;
        pointer-events: none;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .card img {
        width: 100%;
        height: auto;
        display: block;
        background: var(--bg-panel-alt);
      }

      .type-placeholder {
        width: 100%;
        aspect-ratio: 1 / 1;
        background: var(--bg-panel-alt);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: var(--text-muted);
        padding: 12px;
        text-align: center;
        overflow: hidden;
      }

      .type-placeholder.text {
        font-size: 12px;
        color: var(--text-muted);
        align-items: flex-start;
        justify-content: flex-start;
        line-height: 1.4;
      }

      .video-thumb {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        background: var(--bg-panel-alt);
      }

      .video-thumb img {
        width: 100%;
        height: auto;
        aspect-ratio: 1 / 1;
        object-fit: cover;
      }

      .video-thumb .video-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 48px;
        color: white;
        text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
        pointer-events: none;
      }

      .link-thumb {
        position: relative;
      }

      .link-thumb img {
        width: 100%;
        height: auto;
        aspect-ratio: 1 / 1;
        object-fit: cover;
      }

      .link-thumb .link-icon {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 20px;
        opacity: 0.8;
      }

      .card-info {
        padding: 10px;
      }

      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .tag {
        background: var(--accent);
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
      }

      .card-stats {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 6px;
      }

      .post-link {
        position: absolute;
        top: 4px;
        right: 4px;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        text-decoration: none;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        z-index: 10;
      }

      .post-link:hover {
        background: var(--accent);
        text-decoration: none;
      }

      .post-link.deleted {
        background: rgba(239, 68, 68, 0.8);
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

    // If a preview URL failed, fall back to the original image URL
    if (src.includes('/preview/') && !img.dataset.triedOriginal) {
      img.dataset.triedOriginal = 'true';
      // Remove the /preview/VARIANT/ part of the path
      img.src = src.replace(/\/preview\/[^/]+\//, '/');
      return;
    }

    // Try CDN fallback (ocdn -> cdn)
    if (src.includes('ocdn012.bdsmlr.com') && !img.dataset.triedFallback) {
      img.dataset.triedFallback = 'true';
      img.src = src.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
      return;
    }

    // If everything failed, show placeholder
    if (!img.dataset.showedPlaceholder) {
      img.dataset.showedPlaceholder = 'true';
      img.style.display = 'none';
      const placeholder = document.createElement('div');
      placeholder.className = 'error-ghost ghost';
      placeholder.innerHTML = `
        <span class="error-icon">🖼️</span>
        <span style="font-size: 11px; opacity: 0.7;">Content Unavailable</span>
      `;
      img.parentElement?.insertBefore(placeholder, img);
    }
  }

  /**
   * Rewrite CDN URLs to use imageproxy for thumbnails.
   * e.g., /uploads/photos/foo.jpg -> /uploads/preview/400x/photos/foo.jpg
   */
  private getProxyUrl(url: string | undefined): string {
    if (!url) return '';
    let normalized = url;
    // Fix broken TLS on ocdn012
    if (normalized.includes('ocdn012.bdsmlr.com')) {
      normalized = normalized.replace('ocdn012.bdsmlr.com', 'cdn012.bdsmlr.com');
    }
    
    // Use 400x width-based scaling (standard variant)
    if (normalized.includes('bdsmlr.com/uploads/') && !normalized.includes('/preview/')) {
      return normalized.replace('/uploads/', '/uploads/preview/400x/');
    }
    return normalized;
  }

  render() {
    const post = this.post;
    const media = post._media;
    if (!media) return nothing;

    const mediaUrl = this.getProxyUrl(media.url);

    const isReblog = post.originPostId && post.originPostId !== post.id;
    const isDeleted = !!post.deletedAtUnix;
    const isOriginDeleted = !!post.originDeletedAtUnix;
    const blogName = (isDeleted ? null : post.blogName) || (isReblog ? 'redacted' : 'unknown');
    const isRedacted = isDeleted || (!post.blogName && isReblog);
    const postUrl =
      post.blogName && !isDeleted
        ? `https://${blogName}.bdsmlr.com/post/${post.id}`
        : `https://bdsmlr.com/post/${post.id}`;
    const originBlogName = post.originBlogName;

    let linkText: string;
    if (isReblog && isOriginDeleted && isRedacted) {
      linkText = '♻️ deleted';
    } else if (isRedacted) {
      linkText = '♻️ redacted';
    } else if (isReblog && isOriginDeleted) {
      // Origin deleted but we have the reblogger
      linkText = `📌 ${blogName}`;
    } else if (isReblog) {
      // Show reblogger + origin: reblogger ♻️ origin (clearer format)
      const originDisplay = originBlogName || '?';
      linkText = `${blogName} ♻️ ${originDisplay}`;
    } else {
      linkText = `📝 ${blogName}`;
    }

    const allTags = post.tags || [];
    const tags = allTags.slice(0, MAX_VISIBLE_TAGS);
    const moreTagsCount = allTags.length - MAX_VISIBLE_TAGS;
    const statsArr: string[] = [];
    if (post.likesCount) statsArr.push(`❤️ ${post.likesCount}`);
    if (post.reblogsCount) statsArr.push(`♻️ ${post.reblogsCount}`);
    if (post.commentsCount) statsArr.push(`💬 ${post.commentsCount}`);
    const statsText = statsArr.join(' ');

    const fileCount = post.content?.files?.length || 0;

    let mediaHtml;
    if (media.type === 'image' && mediaUrl) {
      mediaHtml = html`
        <div style="position: relative;">
          ${fileCount > 1 ? html`<div class="multi-image-badge">1 / ${fileCount}</div>` : ''}
          <img src=${mediaUrl} alt="Post ${post.id}" loading="lazy" @error=${this.handleImageError} />
        </div>
      `;
    } else if (media.type === 'video') {
      if (mediaUrl) {
        mediaHtml = html`
          <div class="video-thumb">
            <img src=${mediaUrl} alt="Post ${post.id}" loading="lazy" @error=${this.handleImageError} />
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
      if (mediaUrl) {
        mediaHtml = html`
          <div class="link-thumb">
            <img src=${mediaUrl} alt="Link" loading="lazy" @error=${this.handleImageError} />
            <span class="link-icon">🔗</span>
          </div>
        `;
      } else {
        mediaHtml = html`<div class="type-placeholder">🔗 ${title.slice(0, 50)}</div>`;
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

    const cardLabel = isDeleted
      ? `Deleted post from ${blogName}`
      : isReblog
        ? `Reblog by ${blogName} from ${originBlogName || 'unknown'}`
        : `Post by ${blogName}`;

    return html`
      <article
        class="card"
        @click=${this.handleClick}
        aria-label=${cardLabel}
        tabindex="0"
        @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.handleClick()}
      >
        <a
          class="post-link ${isDeleted ? 'deleted' : ''}"
          href=${isRedacted ? '#' : postUrl}
          target=${isRedacted ? '' : '_blank'}
          @click=${isRedacted ? (e: Event) => e.preventDefault() : this.handleLinkClick}
          aria-label=${isRedacted ? 'Post unavailable' : `View post by ${blogName}`}
        >
          ${linkText}
        </a>
        ${mediaHtml}
        <div class="card-info">
          ${statsText ? html`<div class="card-stats" aria-label="Post statistics: ${statsArr.map(s => s.replace('❤️', 'likes:').replace('♻️', 'reblogs:').replace('💬', 'comments:')).join(', ')}"><span aria-hidden="true">${statsText}</span></div>` : nothing}
          ${tags.length > 0
            ? html`
                <div class="tags" role="list" aria-label="Tags">
                  ${tags.map((t) => html`<span class="tag" role="listitem">${t}</span>`)}
                  ${moreTagsCount > 0 ? html`<span class="tag" role="listitem" aria-label="${moreTagsCount} more tags">+${moreTagsCount}</span>` : nothing}
                </div>
              `
            : nothing}
        </div>
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-card': PostCard;
  }
}
