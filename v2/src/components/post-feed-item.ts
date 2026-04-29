import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { extractRenderableTags, type ProcessedPost } from '../types/post.js';
import { formatDateShort, getTooltipDate } from '../services/date-formatter.js';
import { MAX_VISIBLE_TAGS } from '../types/ui-constants.js';
import { resolveLink } from '../services/link-resolver.js';
import { toPresentationModel } from '../services/post-presentation.js';
import type { MediaRenderType } from '../services/media-resolver.js';
import type { IdentityDecoration } from '../types/api.js';
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
      .card.non-interactive {
        cursor: default;
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

      .self-activity-badge {
        font-size: 11px;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 2px 8px;
        color: var(--text-muted);
        background: var(--bg-panel-alt);
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
  @property({ type: Boolean }) disableClick = false;
  @property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'feed';
  @property({ type: Boolean }) videoAutoplay?: boolean;
  @property({ type: Boolean }) videoControls?: boolean;
  @property({ type: Boolean }) videoLoop?: boolean;

  private handlePostClick(): void {
    if (this.disableClick) return;
    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post: this.post },
      bubbles: true,
      composed: true
    }));
  }

  private renderIdentityLabel(label: string, decoration?: IdentityDecoration | null) {
    const icon = decoration?.icon?.trim();
    return icon ? `${label} ${icon}` : label;
  }

  render() {
    const post = this.post;
    const presentation = toPresentationModel(post, {
      surface: this.page === 'post' ? 'detail' : 'timeline',
      page: this.page === 'activity' ? 'activity' : this.page,
      interactionKind: post._activityKindOverride,
    });
    const media = post._media;

    const tags = extractRenderableTags(post);
    const blogLabel = presentation.identity.viaBlogLabel;
    const originBlogLabel = presentation.identity.originBlogLabel;
    const isReblog = presentation.identity.isReblog;
    const likeCount = presentation.actions.like.count;
    const reblogCount = presentation.actions.reblog.count;
    const commentCount = presentation.actions.comment.count;
    const mediaRenderType = presentation.media.preset as MediaRenderType;
    const rawUrl = media.type === 'video'
      ? (media.videoUrl || media.url)
      : (media.url || media.videoUrl || media.audioUrl);
    const posterSrc = media.type === 'video' && media.url && media.url !== rawUrl ? media.url : undefined;
    const selfActivityBadge = post._activityKindOverride === 'like'
      ? '❤️ Self-liked'
      : post._activityKindOverride === 'comment'
        ? '💬 Self-commented'
        : '';
    const renderBlogIdentity = (
      link: typeof presentation.identity.viaBlog,
      label: string,
      decoration?: IdentityDecoration | null,
    ) => {
      const renderedLabel = this.renderIdentityLabel(label, decoration);
      if (!link) {
        return html`<span class="blog-name">${renderedLabel}</span>`;
      }
      return html`<a href=${link.href} target=${link.target} rel=${link.rel || nothing} title=${link.title || nothing} class="blog-name" @click=${(e: Event) => e.stopPropagation()}>${renderedLabel}</a>`;
    };

    let mediaHtml;
    if (media.type === 'image' || media.type === 'video') {
      if (rawUrl) {
        mediaHtml = html`
          <div class="media-container">
            <media-renderer
              .src=${rawUrl}
              .posterSrc=${posterSrc}
              .type=${mediaRenderType}
              .autoplayVideo=${this.videoAutoplay}
              .controlsVideo=${this.videoControls}
              .loopVideo=${this.videoLoop}
            ></media-renderer>
          </div>
        `;
      }
    }

    return html`
      <article class="card ${this.disableClick ? 'non-interactive' : ''}" @click=${this.handlePostClick}>
        <header class="card-header">
          <div class="blog-info">
            ${isReblog ? html`
              ${renderBlogIdentity(presentation.identity.originBlog, originBlogLabel, presentation.identity.originBlogDecoration)}
              <span class="reblog-indicator">
                ♻️ via ${renderBlogIdentity(presentation.identity.viaBlog || presentation.identity.originBlog, blogLabel, presentation.identity.viaBlogDecoration)}
              </span>
            ` : html`
              ${renderBlogIdentity(presentation.identity.viaBlog || presentation.identity.originBlog, blogLabel, presentation.identity.viaBlogDecoration)}
            `}
            ${selfActivityBadge ? html`<span class="self-activity-badge">${selfActivityBadge}</span>` : ''}
          </div>
          <time class="post-date" title=${getTooltipDate(post.createdAtUnix)}>${formatDateShort(post.createdAtUnix)}</time>
        </header>

        ${mediaHtml}

        ${post.body ? html`<div class="card-body">${post.body}</div>` : ''}

        ${tags.length > 0 ? html`
          <div class="card-tags">
            ${tags.slice(0, MAX_VISIBLE_TAGS).map(tag => html`
              ${(() => {
                const tagLink = resolveLink('search_tag', { tag });
                return html`<a href=${tagLink.href} title=${tagLink.title || nothing} class="tag-link" @click=${(e: Event) => e.stopPropagation()}>${tagLink.label || `#${tag}`}</a>`;
              })()}
            `)}
          </div>
        ` : ''}

        <footer class="card-footer">
          <div class="card-stats">
            ${likeCount ? html`<span class="stat">${presentation.actions.like.icon} ${likeCount}</span>` : ''}
            ${reblogCount ? html`<span class="stat">${presentation.actions.reblog.icon} ${reblogCount}</span>` : ''}
            ${commentCount ? html`<span class="stat">${presentation.actions.comment.icon} ${commentCount}</span>` : ''}
          </div>
          <div class="post-type-icon">${presentation.identity.postTypeIcon}</div>
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
