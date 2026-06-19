import { LitElement, html, css, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import {
  extractRenderableTags,
  getOrderedContentBlocks,
  resolveMediaItemAudioSource,
  resolveMediaItemImageSource,
  resolveMediaItemPosterSource,
  resolveMediaItemVideoSource,
  type MediaItem,
  type NormalizedContentBlock,
  type ProcessedPost,
} from '../types/post.js';
import { EventNames, type PostSelectDetail } from '../types/events.js';
import { formatDateShort, getTooltipDate } from '../services/date-formatter.js';
import { MAX_VISIBLE_TAGS } from '../types/ui-constants.js';
import { resolveLink } from '../services/link-resolver.js';
import { renderStructuredMicroBlogIdentity } from '../services/blog-identity-render.js';
import { toPresentationModel } from '../services/post-presentation.js';
import { renderCardOverlayLink, shouldLetBrowserHandleCardLink } from '../services/card-overlay.js';
import { getViewedBlogName } from '../services/blog-resolver.js';
import { sanitizeHtmlFragment } from '../services/html-sanitizer.js';
import type { PostRouteSource } from '../services/post-route-context.js';
import type { MediaRenderType } from '../services/media-resolver.js';
import type { IdentityDecoration } from '../types/api.js';
import './media-renderer.js';
import './blog-identity.js';
import './post-actions.js';

function postHasChanged(newVal: ProcessedPost | undefined, oldVal: ProcessedPost | undefined): boolean {
  if (!newVal || !oldVal) return true;
  if (newVal === oldVal) return false;
  if (newVal.id !== oldVal.id) return true;
  if (newVal.likesCount !== oldVal.likesCount) return true;
  if (newVal.reblogsCount !== oldVal.reblogsCount) return true;
  if (newVal.commentsCount !== oldVal.commentsCount) return true;
  if (newVal._media?.url !== oldVal._media?.url) return true;
  if (newVal._media?.videoUrl !== oldVal._media?.videoUrl) return true;
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
        color: var(--text-primary);
        --blog-text: var(--text-primary);
        --blog-identity-text: var(--text-primary);
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: box-shadow 0.2s, transform 0.2s ease;
        border: 1px solid var(--border);
        margin-bottom: 16px;
        box-shadow: 0 16px 32px rgba(0, 0, 0, 0.18);
        position: relative;
      }
      .card.non-interactive {
        cursor: default;
      }

      .card-overlay-link {
        position: absolute;
        inset: 0;
        z-index: 2;
      }

      .card:hover {
        box-shadow: 0 22px 40px rgba(0, 0, 0, 0.22);
        transform: translateY(-2px);
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

      .content-flow {
        display: grid;
      }

      .content-block {
        position: relative;
      }

      .media-container {
        width: 100%;
        background: #000;
        line-height: 0;
        position: relative;
      }

      .card.post-shell .media-container {
        display: flex;
        align-items: center;
        justify-content: center;
        max-height: min(68vh, 760px);
        padding: 10px;
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.05), transparent 55%),
          #050505;
      }

      .media-gallery {
        display: grid;
        gap: 10px;
      }

      .card-body {
        padding: 16px;
        font-size: 14px;
        line-height: 1.5;
        color: var(--text-primary);
      }

      .card-body p:first-child { margin-top: 0; }
      .card-body p:last-child { margin-bottom: 0; }

      .audio-shell {
        padding: 16px;
        background: var(--bg-panel-alt);
      }

      .audio-player {
        width: 100%;
      }

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
    `,
  ];

  @property({ type: Object, hasChanged: postHasChanged }) post!: ProcessedPost;
  @property({ type: Boolean }) disableClick = false;
  @property({ type: String }) page: 'feed' | 'follower-feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'feed';
  @property({ type: Boolean }) videoAutoplay?: boolean;
  @property({ type: Boolean }) videoControls?: boolean;
  @property({ type: Boolean }) videoLoop?: boolean;
  @state() private mediaFailed = false;

  private handleMediaStateChange(event: CustomEvent<{ failed: boolean }>): void {
    this.mediaFailed = Boolean(event.detail?.failed);
  }

  private handlePostClick(): void {
    if (this.disableClick) return;
    const from: PostRouteSource = this.page === 'post' ? 'direct' : this.page;
    this.dispatchEvent(new CustomEvent<PostSelectDetail>(EventNames.POST_SELECT, {
      detail: { post: this.post, from },
      bubbles: true,
      composed: true
    }));
  }

  private handleOverlayClick(event: MouseEvent): void {
    if (this.disableClick || shouldLetBrowserHandleCardLink(event)) {
      return;
    }
    event.preventDefault();
    this.handlePostClick();
  }

  private get shouldShowActions(): boolean {
    return this.page === 'activity' || this.page === 'feed' || this.page === 'follower-feed';
  }

  private renderMicroBlogIdentity(link: ReturnType<typeof resolveLink> | null | undefined, label: string, decoration?: IdentityDecoration | null, blogId?: number | null) {
    return renderStructuredMicroBlogIdentity({
      link,
      label,
      blogId,
      decoration,
      className: 'blog-name',
      stopClick: true,
      showAvatar: false,
    });
  }

  private normalizeBlogName(name: string | undefined | null): string {
    return (name || '').trim().toLowerCase();
  }

  private renderSelfActivityBadge(post: ProcessedPost): string {
    const kind = post._activityKindOverride;
    if (kind !== 'like' && kind !== 'comment') return '';

    const viewedBlog = this.normalizeBlogName(getViewedBlogName());
    const actorBlog = this.normalizeBlogName(post.blogName);
    const samePerspective = Boolean(viewedBlog) && viewedBlog === actorBlog;

    if (samePerspective) {
      return kind === 'like' ? '❤️ Self-liked' : '💬 Self-commented';
    }

    return kind === 'like' ? '❤️ Liked own post' : '💬 Commented on own post';
  }

  private renderMediaItem(item: MediaItem, mediaRenderType: MediaRenderType, useMediaClickZone: boolean, post: ProcessedPost) {
    const representationKind = post._media?.representationKind;
    const animatedAlternateSrc = item.kind === 'IMAGE' && representationKind === 'ANIMATED_VIDEO'
      ? resolveMediaItemVideoSource(item, representationKind)
      : '';

    if (item.kind === 'AUDIO') {
      const audioSrc = resolveMediaItemAudioSource(item);
      if (!audioSrc) return nothing;
      return html`
        <div class="audio-shell">
          <audio class="audio-player" controls src=${audioSrc}></audio>
        </div>
      `;
    }

    const src = item.kind === 'VIDEO'
      ? resolveMediaItemVideoSource(item, representationKind)
      : animatedAlternateSrc
      ? (item.original?.url || '')
      : resolveMediaItemImageSource(item, 'preview');
    const posterSrc = item.kind === 'VIDEO' || animatedAlternateSrc ? (resolveMediaItemPosterSource(item) || undefined) : undefined;
    const fallbackSrc = animatedAlternateSrc ? (item.original?.url || undefined) : undefined;
    if (!src) return nothing;

    return html`
      <div class="media-container">
        ${useMediaClickZone ? renderCardOverlayLink(post._media ? toPresentationModel(post, {
          surface: this.page === 'post' ? 'detail' : 'timeline',
          page: this.page === 'activity' ? 'activity' : this.page === 'follower-feed' ? 'feed' : this.page,
          interactionKind: post._activityKindOverride,
        }).identity.permalink : resolveLink('post', { postId: post.id }), `Open post ${post.id}`, (event: MouseEvent) => this.handleOverlayClick(event), this.mediaFailed) : nothing}
        <media-renderer
          .src=${src}
          .posterSrc=${posterSrc}
          .alternateVideoSrc=${animatedAlternateSrc || undefined}
          .fallbackSrc=${fallbackSrc}
          .type=${mediaRenderType}
          .forceImage=${item.kind === 'IMAGE'}
          .autoplayVideo=${this.videoAutoplay}
          .controlsVideo=${this.videoControls}
          .loopVideo=${this.videoLoop}
          @media-state-change=${this.handleMediaStateChange}
        ></media-renderer>
      </div>
    `;
  }

  private renderMediaBlock(items: MediaItem[], mediaRenderType: MediaRenderType, useMediaClickZone: boolean, post: ProcessedPost) {
    if (items.length === 0) return nothing;
    if (items.length === 1) {
      return this.renderMediaItem(items[0], mediaRenderType, useMediaClickZone, post);
    }
    return html`
      <div class="media-gallery">
        ${items.map((item) => this.renderMediaItem(item, mediaRenderType, false, post))}
      </div>
    `;
  }

  private renderContentBlock(block: NormalizedContentBlock, index: number, mediaRenderType: MediaRenderType, useMediaClickZone: boolean, post: ProcessedPost) {
    if (block.kind === 'media') {
      return html`
        <div class="content-block" data-content-block="media" data-block-index=${String(index)}>
          ${this.renderMediaBlock(block.items, mediaRenderType, useMediaClickZone, post)}
        </div>
      `;
    }

    if (block.kind === 'html') {
      return html`
        <div class="card-body content-block" data-content-block="html" data-block-index=${String(index)}>
          ${unsafeHTML(sanitizeHtmlFragment(block.html))}
        </div>
      `;
    }

    return html`
      <div class="card-body content-block" data-content-block="text" data-block-index=${String(index)}>
        ${block.text}
      </div>
    `;
  }

  render() {
    const post = this.post;
    const presentation = toPresentationModel(post, {
      surface: this.page === 'post' ? 'detail' : 'timeline',
      page: this.page === 'activity' ? 'activity' : this.page === 'follower-feed' ? 'feed' : this.page,
      interactionKind: post._activityKindOverride,
    });
    const tags = extractRenderableTags(post);
    const blogLabel = presentation.identity.viaBlogLabel;
    const originBlogLabel = presentation.identity.originBlogLabel;
    const isReblog = presentation.identity.isReblog;
    const likeCount = presentation.actions.like.count;
    const reblogCount = presentation.actions.reblog.count;
    const commentCount = presentation.actions.comment.count;
    const mediaRenderType = presentation.media.preset as MediaRenderType;
    const orderedBlocks = getOrderedContentBlocks(post);
    const isPostShell = this.page === 'post';
    const selfActivityBadge = this.renderSelfActivityBadge(post);
    const useMediaClickZone = presentation.layout.clickZone === 'media' && !this.disableClick && !isPostShell;

    return html`
      <article class="card ${this.disableClick ? 'non-interactive' : ''} ${isPostShell ? 'post-shell' : ''}">
        <header class="card-header">
          <div class="blog-info">
            ${isReblog ? html`
              ${this.renderMicroBlogIdentity(presentation.identity.originBlog, originBlogLabel, presentation.identity.originBlogDecoration, post.originBlogId)}
              <span class="reblog-indicator">
                ♻️ via ${this.renderMicroBlogIdentity(presentation.identity.viaBlog || presentation.identity.originBlog, blogLabel, presentation.identity.viaBlogDecoration, post.blogId)}
              </span>
            ` : html`
              ${this.renderMicroBlogIdentity(presentation.identity.viaBlog || presentation.identity.originBlog, blogLabel, presentation.identity.viaBlogDecoration, post.blogId)}
            `}
            ${selfActivityBadge ? html`<span class="self-activity-badge">${selfActivityBadge}</span>` : ''}
          </div>
          <time class="post-date" title=${getTooltipDate(post.createdAtUnix)}>${formatDateShort(post.createdAtUnix)}</time>
        </header>

        ${orderedBlocks.length > 0 ? html`
          <div class="content-flow">
            ${orderedBlocks.map((block, index) => this.renderContentBlock(block, index, mediaRenderType, useMediaClickZone, post))}
          </div>
        ` : nothing}

        ${!isPostShell && tags.length > 0 ? html`
          <div class="card-tags">
            ${tags.slice(0, MAX_VISIBLE_TAGS).map(tag => html`
              ${(() => {
                const tagLink = resolveLink('search_tag', { tag });
                return html`<a href=${tagLink.href} title=${tagLink.title || nothing} class="tag-link" @click=${(e: Event) => e.stopPropagation()}>${tagLink.label || `#${tag}`}</a>`;
              })()}
            `)}
          </div>
        ` : ''}

        ${!isPostShell ? html`
          <footer class="card-footer">
            ${this.shouldShowActions
              ? html`<post-actions variant="card" .post=${post}></post-actions>`
              : html`
                  <div class="card-stats">
                    ${likeCount ? html`<span class="stat">${presentation.actions.like.icon} ${likeCount}</span>` : ''}
                    ${reblogCount ? html`<span class="stat">${presentation.actions.reblog.icon} ${reblogCount}</span>` : ''}
                    ${commentCount ? html`<span class="stat">${presentation.actions.comment.icon} ${commentCount}</span>` : ''}
                  </div>
                  <div class="post-type-icon">${presentation.identity.postTypeIcon}</div>
                `}
          </footer>
        ` : ''}
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-feed-item': PostFeedItem;
  }
}
