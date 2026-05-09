import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { FollowEdge } from '../types/api.js';
import type { IdentityDecoration } from '../types/api.js';
import { buildBlogPageUrl } from '../services/blog-resolver.js';
import { BREAKPOINTS, SPACING, CONTAINER_SPACING } from '../types/ui-constants.js';
import { loadRenderContract } from '../services/render-contract.js';
import { handleAvatarImageError, normalizeAvatarUrl } from '../services/avatar-url.js';
import { extractMedia, POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import './media-renderer.js';
import './blog-identity.js';

interface RawFollowEdge extends FollowEdge {
  blog_id?: number;
  blog_name?: string;
  user_id?: number;
}

function normalizeFollowEdge(item: RawFollowEdge): FollowEdge {
  return {
    ...item,
    blogId: item.blogId ?? item.blog_id ?? 0,
    blogName: item.blogName ?? item.blog_name,
    userId: item.userId ?? item.user_id,
  };
}

@customElement('blog-list')
export class BlogList extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 ${unsafeCSS(CONTAINER_SPACING.HORIZONTAL)}px;
      }

      .list {
        display: grid;
        grid-template-columns: 1fr;
        gap: ${unsafeCSS(SPACING.MD)}px;
      }

      @media (min-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .list {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (min-width: ${unsafeCSS(BREAKPOINTS.TABLET)}px) {
        .list {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      .list-item {
        display: grid;
        grid-template-rows: minmax(96px, auto) 100px;
        gap: 12px;
        padding: 14px;
        background: var(--bg-panel);
        border-radius: ${unsafeCSS(SPACING.SM)}px;
        cursor: pointer;
        transition: background 0.2s;
        border: 1px solid var(--border);
        min-height: 208px;
      }

      .list-item:hover {
        background: var(--bg-panel-alt);
      }

      .list-item.no-navigate {
        cursor: default;
        opacity: 0.6;
      }

      .list-item.no-navigate:hover {
        background: var(--bg-panel);
      }

      .blog-info {
        display: grid;
        grid-template-columns: minmax(80px, 1fr) minmax(0, 2fr);
        align-items: center;
        gap: 14px;
        min-height: 96px;
      }

      .blog-copy {
        min-width: 0;
        display: grid;
        gap: 4px;
      }

      .blog-name {
        font-size: 14px;
        color: var(--text-primary);
        min-width: 0;
      }

      .blog-title,
      .blog-description {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .blog-title {
        font-size: 13px;
        color: var(--text-primary);
      }

      .blog-description {
        font-size: 12px;
        color: var(--text-muted);
      }

      .empty {
        text-align: center;
        padding: ${unsafeCSS(SPACING.XXL)}px;
        color: var(--text-muted);
      }

      .avatar {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
      }

      .avatar-placeholder {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: var(--bg-panel-alt);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 600;
        color: var(--text-muted);
        flex-shrink: 0;
      }

      .recent-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        min-height: 100px;
      }

      .recent-item {
        min-width: 0;
        height: 100px;
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
      }

      .recent-item media-renderer {
        width: 100%;
        height: 100%;
      }

      .recent-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        font-size: 11px;
      }

      .recent-fallback {
        width: 100%;
        height: 100%;
        display: grid;
        align-content: center;
        justify-items: center;
        gap: 6px;
        padding: 8px;
        box-sizing: border-box;
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        text-align: center;
      }

      .recent-fallback-icon {
        font-size: 18px;
      }

      .recent-fallback-text {
        font-size: 11px;
        color: var(--text-muted);
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `,
  ];

  @property({ type: Array }) items: FollowEdge[] = [];
  @property({ attribute: false }) contextIdentityDecorations: IdentityDecoration[] = [];
  private readonly socialBlogCard = (loadRenderContract().cards as any).social_blog;

  private sanitizeSingleLine(value: string | undefined): string {
    return `${value || ''}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private handleItemClick(item: FollowEdge): void {
    if (item.blogName) {
      window.location.href = buildBlogPageUrl(item.blogName, 'activity');
      return;
    }
    if (item.blogId) {
      window.location.href = buildBlogPageUrl(String(item.blogId), 'activity');
    }
  }

  render() {
    if (!this.socialBlogCard) {
      throw new Error('Render contract missing required card: social_blog');
    }

    if (this.items.length === 0) {
      return html`<section class="empty" role="status">No items to display</section>`;
    }

    return html`
      <section class="list" role="list" aria-label="Blog list">
        ${this.items.map((rawItem) => {
          const item = normalizeFollowEdge(rawItem as RawFollowEdge);
          const canNavigate = Boolean(item.blogName || item.blogId);
          const avatarUrl = normalizeAvatarUrl(item.avatarUrl || null);
          const initial = (item.blogName || 'B').charAt(0).toUpperCase();
          const recentPosts = (item.recentPosts || []).slice(0, 3).map((post) => ({
            ...post,
            _media: (post as ProcessedPost)._media || extractMedia(post),
          })) as ProcessedPost[];
          const effectiveIdentityDecorations = [
            ...(item.identityDecorations || []),
            ...this.contextIdentityDecorations,
          ];

          return html`
            <div
              class="list-item ${canNavigate ? '' : 'no-navigate'}"
              @click=${() => canNavigate && this.handleItemClick(item)}
              role="listitem"
              tabindex=${canNavigate ? '0' : '-1'}
              @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && canNavigate && this.handleItemClick(item)}
              aria-label=${item.blogName ? `View ${item.blogName}'s activity` : `Blog ${item.blogId}`}
            >
              <div class="blog-info">
                ${avatarUrl
                  ? html`
                      <img class="avatar" src=${avatarUrl} alt="" @error=${handleAvatarImageError} />
                      <div class="avatar-placeholder" style="display: none;" aria-hidden="true">${initial}</div>
                    `
                  : html`<div class="avatar-placeholder" aria-hidden="true">${initial}</div>`}
                <div class="blog-copy">
                  <div class="blog-name">
                    <blog-identity
                      variant="micro"
                      .blogName=${item.blogName || `blog:${item.blogId}`}
                      .blogId=${item.blogId || 0}
                      .blogTitle=${item.title || ''}
                      .identityDecorations=${effectiveIdentityDecorations}
                      .showAvatar=${false}
                    ></blog-identity>
                  </div>
                  <div class="blog-title">${this.sanitizeSingleLine(item.title)}</div>
                  <div class="blog-description">${this.sanitizeSingleLine(item.description)}</div>
                </div>
              </div>
              <div class="recent-grid" aria-hidden="true">
                ${recentPosts.length > 0
                  ? recentPosts.map((post) => {
                      const media = post._media;
                      const rawUrl = media.url || media.videoUrl || media.audioUrl;
                      const previewText = this.sanitizeSingleLine(post.body || post.content?.text || post.content?.title || '');
                      return html`
                        <div class="recent-item">
                          ${rawUrl
                            ? html`<media-renderer .src=${rawUrl} .type=${'card'} style="object-fit: cover;"></media-renderer>`
                            : html`
                                <div class="recent-fallback">
                                  <div class="recent-fallback-icon">${POST_TYPE_ICONS[post.type] || '📄'}</div>
                                  <div class="recent-fallback-text">${previewText || 'Post'}</div>
                                </div>
                              `}
                        </div>
                      `;
                    })
                  : Array.from({ length: 3 }, () => html`<div class="recent-item"><div class="recent-placeholder">No preview</div></div>`)}
              </div>
            </div>
          `;
        })}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blog-list': BlogList;
  }
}
