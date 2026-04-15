import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { formatDate } from '../services/date-formatter.js';
import { getCachedBlogId, getCurrentBlog } from '../services/storage.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import type { Like, Comment, Reblog, PostType } from '../types/api.js';
import { resolveLink } from '../services/link-resolver.js';
import './loading-spinner.js';
import './post-actions.js';

@customElement('post-engagement')
export class PostEngagement extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; }

      .engagement-section {
        background: var(--bg-panel);
        padding: 24px;
        border-radius: 8px;
        border: 1px solid var(--border);
        width: 100%;
        margin-top: 16px;
      }

      .lightbox-links { font-size: 16px; margin-bottom: 12px; color: var(--text-muted); }
      .lightbox-links a { color: var(--accent); text-decoration: none; font-weight: 600; }
      .post-id-link { display: inline-flex; align-items: center; gap: 4px; }
      .post-id-outlink { font-size: 12px; opacity: 0.75; }
      
      .meta { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }

      .detail-list { background: var(--bg-panel-alt); border-radius: 8px; padding: 12px; margin-top: 12px; max-height: 300px; overflow-y: auto; }
      .detail-section-title { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-muted); margin: 0 0 8px; }
      .detail-divider { margin: 12px 0; border-top: 1px solid var(--border-subtle); }
      .detail-item { padding: 8px; border-bottom: 1px solid var(--border-subtle); font-size: 13px; display: flex; align-items: center; justify-content: space-between; }
      .detail-item:last-child { border-bottom: none; }
      .detail-item a { color: var(--accent); text-decoration: none; }

      .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
      .tag { background: var(--bg-panel-alt); padding: 4px 12px; border-radius: 16px; font-size: 13px; color: var(--text); border: 1px solid var(--border); }
    `,
  ];

  @property({ type: Object }) post: ProcessedPost | null = null;
  @property({ type: Boolean }) standalone = false;

  @state() private activeTab: 'likes' | 'reblogs' | 'comments' | null = null;
  @state() private likes: Like[] | null = null;
  @state() private comments: Comment[] | null = null;
  @state() private reblogs: Reblog[] | null = null;
  @state() private loadingDetails = false;

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('post')) {
      this.activeTab = null;
      this.likes = null;
      this.comments = null;
      this.reblogs = null;
      this.loadingDetails = false;
    }
  }

  private async toggleTab(tab: 'likes' | 'reblogs' | 'comments') {
    if (this.activeTab === tab) { this.activeTab = null; return; }
    this.activeTab = tab;
    if (!this.post) return;

    this.loadingDetails = true;
    try {
      if (tab === 'likes' && !this.likes) {
        const resp = await apiClient.engagement.getLikes(this.post.id);
        this.likes = resp.likes || [];
      } else if (tab === 'reblogs' && !this.reblogs) {
        const resp = await apiClient.engagement.getReblogs(this.post.id);
        this.reblogs = resp.reblogs || [];
      } else if (tab === 'comments' && !this.comments) {
        const resp = await apiClient.engagement.getComments(this.post.id);
        this.comments = resp.comments || [];
        const fetchedCount = this.comments.length;
        const currentCount = this.post.commentsCount ?? 0;
        if (fetchedCount > currentCount) {
          this.post = { ...this.post, commentsCount: fetchedCount };
        }
      }
    } catch (e) {
      console.error(`Failed to fetch ${tab}`, e);
    } finally {
      this.loadingDetails = false;
    }
  }

  private handleOpenTab(event: CustomEvent<{ tab: 'likes' | 'reblogs' | 'comments' }>) {
    void this.toggleTab(event.detail.tab);
  }

  private renderLinks() {
    if (!this.post) return nothing;
    const p = this.post;
    const typeIcon = POST_TYPE_ICONS[p.type as PostType] || '📄';
    const isReblog = p.originPostId && p.originPostId !== p.id;

    if (isReblog) {
      const originPostLink = resolveLink('post_permalink', { postId: p.originPostId as number });
      const viaPostLink = resolveLink('post_permalink', { postId: p.id });
      const originPostLabel = originPostLink.label || String(p.originPostId);
      const viaPostLabel = viaPostLink.label || String(p.id);
      const originPostIcon = originPostLink.icon || '↗';
      const viaPostIcon = viaPostLink.icon || '↗';
      return html`
        ${typeIcon} ${this.renderBlogIdentity(p.originBlogName, 'post_origin_blog')} /
        <a class="post-id-link" href=${originPostLink.href} target=${originPostLink.target} rel=${originPostLink.rel || nothing} title=${originPostLink.title || nothing}>${originPostLabel}<span class="post-id-outlink">${originPostIcon}</span></a>
        via ♻️ ${this.renderBlogIdentity(p.blogName)} /
        <a class="post-id-link" href=${viaPostLink.href} target=${viaPostLink.target} rel=${viaPostLink.rel || nothing} title=${viaPostLink.title || nothing}>${viaPostLabel}<span class="post-id-outlink">${viaPostIcon}</span></a>
      `;
    }
    return html`${typeIcon} ${this.renderBlogIdentity(p.blogName)} / ${p.id}`;
  }

  private normalizeBlogName(blogName: string | null | undefined): string | null {
    const normalized = (blogName || '').trim();
    return normalized || null;
  }

  private renderBlogIdentity(blogName: string | null | undefined, contextId: 'post_origin_blog' | 'post_via_blog' = 'post_via_blog') {
    const normalized = this.normalizeBlogName(blogName);
    const label = normalized ? `@${normalized}` : '@unknown';
    if (!normalized) {
      return html`<span>${label}</span>`;
    }
    const link = resolveLink(contextId, { blog: normalized });
    return html`<a href=${link.href} target=${link.target} rel=${link.rel || nothing} title=${link.title || nothing}>${link.label || label}</a>`;
  }

  private getActiveBlogId(): number | null {
    const currentBlog = getCurrentBlog();
    if (!currentBlog) {
      return null;
    }
    const cachedBlogId = getCachedBlogId(currentBlog);
    return typeof cachedBlogId === 'number' ? cachedBlogId : null;
  }

  private splitPersonalActivity<T extends { blogId?: number }>(rows: T[] | null): { myRows: T[]; allRows: T[] } {
    const allRows = rows || [];
    const activeBlogId = this.getActiveBlogId();
    if (!activeBlogId) {
      return { myRows: [], allRows };
    }
    return {
      myRows: allRows.filter((row) => row.blogId === activeBlogId),
      allRows,
    };
  }

  private renderPersonalizedList<T extends { blogId?: number }>(
    rows: T[] | null,
    renderRow: (row: T) => unknown,
  ) {
    const { myRows, allRows } = this.splitPersonalActivity(rows);
    if (allRows.length === 0) {
      return nothing;
    }
    return html`
      <div class="detail-list">
        ${myRows.length > 0 ? html`
          <div class="detail-section-title">My activity</div>
          ${myRows.map((row) => renderRow(row))}
          <div class="detail-divider"></div>
        ` : nothing}
        <div class="detail-section-title">All activity</div>
        ${allRows.map((row) => renderRow(row))}
      </div>
    `;
  }

  private renderEngagementDetail() {
    if (this.loadingDetails) return html`<loading-spinner message="Fetching details..."></loading-spinner>`;
    
    if (this.activeTab === 'likes' && this.likes) {
      return this.renderPersonalizedList(this.likes, (l) => html`<div class="detail-item"><span>❤️ by ${this.renderBlogIdentity(l.blogName)}</span><span class="ts">${formatDate(l.createdAtUnix, 'friendly')}</span></div>`);
    }
    if (this.activeTab === 'reblogs' && this.reblogs) {
      return this.renderPersonalizedList(this.reblogs, (r) => html`<div class="detail-item"><span>♻️ by ${this.renderBlogIdentity(r.blogName, 'post_via_blog')}</span><span class="ts">${formatDate(r.createdAtUnix, 'friendly')}</span></div>`);
    }
    if (this.activeTab === 'comments' && this.comments) {
      return this.renderPersonalizedList(this.comments, (c) => html`<div class="detail-item"><span>💬 <b>${this.normalizeBlogName(c.blogName) ? `@${this.normalizeBlogName(c.blogName)}` : '@unknown'}</b>: ${c.body}</span><span class="ts">${formatDate(c.createdAtUnix, 'friendly')}</span></div>`);
    }
    return nothing;
  }

  render() {
    if (!this.post) return nothing;
    const p = this.post;

    return html`
      <div class="${this.standalone ? 'engagement-section' : ''}">
        <div class="lightbox-links">${this.renderLinks()}</div>
        <div class="meta">Posted ${formatDate(p.createdAtUnix, 'friendly')}</div>
        
        <post-actions variant="detail" .post=${p} @engagement-open-tab=${this.handleOpenTab}></post-actions>

        ${this.renderEngagementDetail()}

        <div class="tags">${(p.tags || []).map(t => html`<span class="tag">#${t}</span>`)}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-engagement': PostEngagement;
  }
}
