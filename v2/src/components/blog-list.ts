import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { Blog, FollowEdge } from '../types/api.js';
import { apiClient } from '../services/client.js';
import { getCachedAvatarUrl, setCachedAvatarUrl } from '../services/storage.js';
import { buildBlogPageUrl } from '../services/blog-resolver.js';
import { BREAKPOINTS, SPACING, CONTAINER_SPACING } from '../types/ui-constants.js';
import { loadRenderContract } from '../services/render-contract.js';
import { handleAvatarImageError, normalizeAvatarUrl } from '../services/avatar-url.js';
import { extractMedia, POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import './media-renderer.js';
import './blog-identity.js';

/**
 * Extended type to handle both camelCase and snake_case API responses.
 * The API may return either format, so we need to handle both.
 */
interface RawFollowEdge extends FollowEdge {
  blog_id?: number;
  blog_name?: string;
  user_id?: number;
}

/**
 * Normalize a FollowEdge item to handle both camelCase and snake_case field names.
 * The API may return blog_id/blog_name (snake_case) or blogId/blogName (camelCase).
 */
function normalizeFollowEdge(item: RawFollowEdge): { blogId: number | undefined; blogName: string | undefined; userId: number | undefined } {
  return {
    blogId: item.blogId ?? item.blog_id,
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
        /* UIC-021: Use standardized container spacing */
        padding: 0 ${unsafeCSS(CONTAINER_SPACING.HORIZONTAL)}px;
      }

      .list {
        display: grid;
        grid-template-columns: 1fr;
        /* UIC-021: Use standardized spacing scale */
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

      .action {
        font-size: 12px;
        color: var(--accent);
      }

      .empty {
        text-align: center;
        /* UIC-021: Use standardized spacing scale */
        padding: ${unsafeCSS(SPACING.XXL)}px;
        color: var(--text-muted);
      }

      .resolving {
        color: var(--text-muted);
        font-style: italic;
      }

      .blog-id {
        color: var(--text-muted);
        font-size: 11px;
      }

      /* Avatar styles (SOC-016) */
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

  @state() private resolvedNames: Map<number, string | null> = new Map();
  @state() private resolvingIds: Set<number> = new Set();
  // Avatar state (SOC-016)
  @state() private avatarUrls: Map<number, string | null> = new Map();
  @state() private fetchingAvatars: Set<number> = new Set();
  @state() private blogMeta: Map<number, Blog | null> = new Map();
  @state() private recentPosts: Map<number, ProcessedPost[]> = new Map();
  @state() private fetchingRecentPosts: Set<number> = new Set();
  private readonly socialBlogCard = (loadRenderContract().cards as any).social_blog;

  private pendingResolve: number[] = [];
  private resolveTimeout: number | null = null;
  // Avatar batch fetch debounce (SOC-016)
  private pendingAvatarFetch: number[] = [];
  private avatarFetchTimeout: number | null = null;

  updated(changedProps: Map<PropertyKey, unknown>): void {
    if (changedProps.has('items')) {
      this.resolveUnknownNames();
      this.fetchMissingAvatars(); // SOC-016
      this.fetchMissingRecentPosts();
    }
  }

  private resolveUnknownNames(): void {
    // Find items without blog names that need resolution
    const unknownIds: number[] = [];
    for (const item of this.items) {
      const normalized = normalizeFollowEdge(item as RawFollowEdge);
      if (!normalized.blogName && normalized.blogId) {
        // Check if already resolved or being resolved
        if (!this.resolvedNames.has(normalized.blogId) && !this.resolvingIds.has(normalized.blogId)) {
          unknownIds.push(normalized.blogId);
        }
      }
    }

    if (unknownIds.length === 0) return;

    // Add to pending list and debounce the resolution
    this.pendingResolve.push(...unknownIds);

    if (this.resolveTimeout) {
      clearTimeout(this.resolveTimeout);
    }

    this.resolveTimeout = window.setTimeout(() => {
      this.doBatchResolve();
    }, 100);
  }

  /**
   * Find items with blogId that need avatar fetching.
   * Checks localStorage cache first, then queues API fetch for misses.
   */
  private fetchMissingAvatars(): void {
    const idsNeedingFetch: number[] = [];

    for (const item of this.items) {
      const normalized = normalizeFollowEdge(item as RawFollowEdge);
      if (!normalized.blogId) continue;

      // Skip if already fetched or fetching
      if (this.avatarUrls.has(normalized.blogId) || this.fetchingAvatars.has(normalized.blogId)) {
        continue;
      }

      // Check localStorage cache first
      const cached = getCachedAvatarUrl(normalized.blogId);
      if (cached !== undefined) {
        // Cache hit - update state directly
        const newAvatars = new Map(this.avatarUrls);
        newAvatars.set(normalized.blogId, cached);
        this.avatarUrls = newAvatars;
        continue;
      }

      // Cache miss - queue for API fetch
      idsNeedingFetch.push(normalized.blogId);
    }

    if (idsNeedingFetch.length === 0) return;

    // Add to pending list and debounce the fetch
    this.pendingAvatarFetch.push(...idsNeedingFetch);

    if (this.avatarFetchTimeout) {
      clearTimeout(this.avatarFetchTimeout);
    }

    this.avatarFetchTimeout = window.setTimeout(() => {
      this.doBatchAvatarFetch();
    }, 150); // Slightly longer debounce for avatar fetching
  }

  /**
   * Batch fetch avatars for pending blog IDs.
   * Uses getBlog API to fetch blog details including avatarUrl.
   */
  private async doBatchAvatarFetch(): Promise<void> {
    const idsToFetch = [...new Set(this.pendingAvatarFetch)];
    this.pendingAvatarFetch = [];
    this.avatarFetchTimeout = null;

    if (idsToFetch.length === 0) return;

    // Mark as fetching
    this.fetchingAvatars = new Set([...this.fetchingAvatars, ...idsToFetch]);

    // Fetch in batches to avoid overwhelming the API
    const BATCH_SIZE = 10;
    for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
      const batch = idsToFetch.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (blogId) => {
        try {
          const response = await apiClient.blogs.get({ blog_id: blogId });
          const blog = response.blog || null;
          const avatarUrl = blog?.avatarUrl || null;

          // Cache the result
          setCachedAvatarUrl(blogId, avatarUrl);

          // Update state
          const newAvatars = new Map(this.avatarUrls);
          newAvatars.set(blogId, avatarUrl);
          this.avatarUrls = newAvatars;
          const nextMeta = new Map(this.blogMeta);
          nextMeta.set(blogId, blog);
          this.blogMeta = nextMeta;
          if (blog?.name) {
            const nextResolved = new Map(this.resolvedNames);
            nextResolved.set(blogId, blog.name);
            this.resolvedNames = nextResolved;
          }
        } catch {
          // On error, cache null to avoid repeated fetches
          setCachedAvatarUrl(blogId, null);

          const newAvatars = new Map(this.avatarUrls);
          newAvatars.set(blogId, null);
          this.avatarUrls = newAvatars;
        }
      });

      await Promise.all(promises);
    }

    // Remove from fetching set
    const newFetching = new Set(this.fetchingAvatars);
    for (const id of idsToFetch) {
      newFetching.delete(id);
    }
    this.fetchingAvatars = newFetching;
  }

  private fetchMissingRecentPosts(): void {
    const idsNeedingFetch: number[] = [];

    for (const item of this.items) {
      const normalized = normalizeFollowEdge(item as RawFollowEdge);
      if (!normalized.blogId) continue;
      if (this.recentPosts.has(normalized.blogId) || this.fetchingRecentPosts.has(normalized.blogId)) {
        continue;
      }
      idsNeedingFetch.push(normalized.blogId);
    }

    if (!idsNeedingFetch.length) return;

    const nextFetching = new Set(this.fetchingRecentPosts);
    idsNeedingFetch.forEach((id) => nextFetching.add(id));
    this.fetchingRecentPosts = nextFetching;

    void Promise.all(
      idsNeedingFetch.map(async (blogId) => {
        try {
          const response = await apiClient.posts.list({
            blog_id: blogId,
            page: { page_size: 3 },
          });
          const posts = (response.posts || []).slice(0, 3).map((post) => ({
            ...post,
            _media: extractMedia(post),
          })) as ProcessedPost[];
          const nextRecent = new Map(this.recentPosts);
          nextRecent.set(blogId, posts);
          this.recentPosts = nextRecent;
        } catch {
          const nextRecent = new Map(this.recentPosts);
          nextRecent.set(blogId, []);
          this.recentPosts = nextRecent;
        } finally {
          const nextPending = new Set(this.fetchingRecentPosts);
          nextPending.delete(blogId);
          this.fetchingRecentPosts = nextPending;
        }
      }),
    );
  }

  private async doBatchResolve(): Promise<void> {
    const idsToResolve = [...new Set(this.pendingResolve)];
    this.pendingResolve = [];
    this.resolveTimeout = null;

    if (idsToResolve.length === 0) return;

    // Mark as resolving
    this.resolvingIds = new Set([...this.resolvingIds, ...idsToResolve]);
    this.requestUpdate();

    try {
      const names = await apiClient.identity.batchResolveIds(idsToResolve);

      // Update resolved names
      const newResolved = new Map(this.resolvedNames);
      for (const [id, name] of names) {
        newResolved.set(id, name);
      }
      this.resolvedNames = newResolved;

      // Remove from resolving set
      const newResolving = new Set(this.resolvingIds);
      for (const id of idsToResolve) {
        newResolving.delete(id);
      }
      this.resolvingIds = newResolving;
    } catch (e) {
      // On error, just remove from resolving set (will show blog:ID)
      const newResolving = new Set(this.resolvingIds);
      for (const id of idsToResolve) {
        newResolving.delete(id);
      }
      this.resolvingIds = newResolving;
    }
  }

  private getDisplayName(item: FollowEdge): { name: string; isResolving: boolean; hasName: boolean } {
    // Normalize to handle both camelCase and snake_case from API
    const normalized = normalizeFollowEdge(item as RawFollowEdge);

    // Prefer blogName from the item itself
    if (normalized.blogName) {
      return { name: normalized.blogName, isResolving: false, hasName: true };
    }

    // Check if we have a resolved name
    if (normalized.blogId) {
      if (this.resolvingIds.has(normalized.blogId)) {
        return { name: `blog:${normalized.blogId}`, isResolving: true, hasName: false };
      }

      const resolved = this.resolvedNames.get(normalized.blogId);
      if (resolved) {
        return { name: resolved, isResolving: false, hasName: true };
      }

      // Not resolved yet, show ID
      return { name: `blog:${normalized.blogId}`, isResolving: false, hasName: false };
    }

    // Fallback to userId or unknown
    if (normalized.userId) {
      return { name: `user:${normalized.userId}`, isResolving: false, hasName: false };
    }

    return { name: 'unknown', isResolving: false, hasName: false };
  }

  private sanitizeSingleLine(value: string | undefined): string {
    return `${value || ''}`.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private handleItemClick(item: FollowEdge): void {
    // Normalize to handle both camelCase and snake_case from API
    const normalized = normalizeFollowEdge(item as RawFollowEdge);

    // First check for direct blogName
    if (normalized.blogName) {
      window.location.href = buildBlogPageUrl(normalized.blogName, 'activity');
      return;
    }

    // Check if we have a resolved name for this blogId
    if (normalized.blogId) {
      const resolved = this.resolvedNames.get(normalized.blogId);
      if (resolved) {
        window.location.href = buildBlogPageUrl(resolved, 'activity');
        return;
      }
      // Fallback to navigating by ID (may not work but better than nothing)
      window.location.href = buildBlogPageUrl(String(normalized.blogId), 'activity');
    }
  }

  render() {
    if (!this.socialBlogCard) {
      throw new Error('Render contract missing required card: social_blog');
    }

    if (this.items.length === 0) {
      return html`<section class="empty" role="status">No items to display</section>`;
    }

    const isAnyResolving = this.resolvingIds.size > 0;

    return html`
      <section class="list" role="list" aria-label="Blog list" aria-busy=${isAnyResolving ? 'true' : 'false'}>
        ${this.items.map((item) => {
          const { name, isResolving, hasName } = this.getDisplayName(item);
          const normalized = normalizeFollowEdge(item as RawFollowEdge);
          const canNavigate = hasName || !!normalized.blogId;
          const meta = normalized.blogId ? this.blogMeta.get(normalized.blogId) || null : null;
          // Avatar logic (SOC-016)
          const rawAvatarUrl = normalized.blogId ? this.avatarUrls.get(normalized.blogId) : null;
          const avatarUrl = normalizeAvatarUrl(rawAvatarUrl ?? null);
          const initial = (name || 'B').charAt(0).toUpperCase();
          const recentPosts = normalized.blogId ? (this.recentPosts.get(normalized.blogId) || []) : [];

          return html`
            <div
              class="list-item ${canNavigate ? '' : 'no-navigate'}"
              @click=${() => canNavigate && this.handleItemClick(item)}
              role="listitem"
              tabindex=${canNavigate ? '0' : '-1'}
              @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && canNavigate && this.handleItemClick(item)}
              aria-label=${hasName ? `View ${name}'s activity` : `Blog ${name}`}
            >
              <div class="blog-info">
                ${avatarUrl
                  ? html`
                      <img
                        class="avatar"
                        src=${avatarUrl}
                        alt=""
                        @error=${handleAvatarImageError}
                      />
                      <div class="avatar-placeholder" style="display: none;" aria-hidden="true">${initial}</div>
                    `
                  : html`<div class="avatar-placeholder" aria-hidden="true">${initial}</div>`}
                <div class="blog-copy">
                  <div class="blog-name ${isResolving ? 'resolving' : ''}" aria-busy=${isResolving ? 'true' : 'false'}>
                    <blog-identity
                      variant="micro"
                      .blogName=${name}
                      .blogId=${normalized.blogId || 0}
                      .blogTitle=${meta?.title || ''}
                      .identityDecorations=${meta?.identityDecorations || []}
                      .showAvatar=${false}
                    ></blog-identity>${isResolving ? ' (loading...)' : ''}
                  </div>
                  <div class="blog-title">${this.sanitizeSingleLine(meta?.title)}</div>
                  <div class="blog-description">${this.sanitizeSingleLine(meta?.description)}</div>
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
                            ? html`
                                <media-renderer
                                  .src=${rawUrl}
                                  .type=${'card'}
                                  style="object-fit: cover;"
                                ></media-renderer>
                              `
                            : html`
                                <div class="recent-fallback">
                                  <div class="recent-fallback-icon">${POST_TYPE_ICONS[post.type] || '📄'}</div>
                                  <div class="recent-fallback-text">${previewText || 'Post'}</div>
                                </div>
                              `}
                        </div>
                      `;
                    })
                  : Array.from({ length: 3 }).map(() => html`<div class="recent-item"><div class="recent-placeholder">…</div></div>`)}
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
