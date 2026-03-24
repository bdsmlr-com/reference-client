import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { formatDate } from '../services/date-formatter.js';
import { POST_TYPE_ICONS, type ProcessedPost } from '../types/post.js';
import type { Like, Comment, Reblog, PostType } from '../types/api.js';
import { resolveLink } from '../services/link-resolver.js';
import './loading-spinner.js';

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

      .stats-bar { display: flex; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 16px; }
      .stat-btn {
        background: var(--bg-panel-alt); border: 1px solid var(--border);
        padding: 6px 12px; border-radius: 20px; font-size: 13px; color: var(--text);
        cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;
      }
      .stat-btn:hover { border-color: var(--accent); }
      .stat-btn.active { background: var(--accent); color: white; border-color: var(--accent); }

      .detail-list { background: var(--bg-panel-alt); border-radius: 8px; padding: 12px; margin-top: 12px; max-height: 300px; overflow-y: auto; }
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
        const list = resp.likes || [];
        const seen = new Set();
        this.likes = list.filter(l => {
          if (seen.has(l.blogName)) return false;
          seen.add(l.blogName);
          return true;
        });
      } else if (tab === 'reblogs' && !this.reblogs) {
        const resp = await apiClient.engagement.getReblogs(this.post.id);
        const list = resp.reblogs || [];
        const seen = new Set();
        this.reblogs = list.filter(r => {
          if (seen.has(r.blogName)) return false;
          seen.add(r.blogName);
          return true;
        });
      } else if (tab === 'comments' && !this.comments) {
        const resp = await apiClient.engagement.getComments(this.post.id);
        const list = resp.comments || [];
        const seen = new Set();
        this.comments = list.filter(c => {
          const key = `${c.blogName}:${c.body}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    } catch (e) {
      console.error(`Failed to fetch ${tab}`, e);
    } finally {
      this.loadingDetails = false;
    }
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

  private renderEngagementDetail() {
    if (this.loadingDetails) return html`<loading-spinner message="Fetching details..."></loading-spinner>`;
    
    if (this.activeTab === 'likes' && this.likes) {
      return html`<div class="detail-list">${this.likes.map(l => html`<div class="detail-item"><span>❤️ by ${this.renderBlogIdentity(l.blogName)}</span><span class="ts">${formatDate(l.createdAtUnix, 'friendly')}</span></div>`)}</div>`;
    }
    if (this.activeTab === 'reblogs' && this.reblogs) {
      return html`<div class="detail-list">${this.reblogs.map(r => {
        const targetPostId = r.postId || (r as any).id;
        const targetLink = resolveLink('post_permalink', { postId: targetPostId });
        return html`<div class="detail-item"><span>♻️ by ${this.renderBlogIdentity(r.blogName, 'post_via_blog')}</span><span><a href=${targetLink.href} target=${targetLink.target} rel=${targetLink.rel || nothing} title=${targetLink.title || nothing}>${targetLink.label || `post:${targetPostId}`}</a></span></div>`;
      })}</div>`;
    }
    if (this.activeTab === 'comments' && this.comments) {
      return html`<div class="detail-list">${this.comments.map(c => html`<div class="detail-item"><span>💬 <b>${this.normalizeBlogName(c.blogName) ? `@${this.normalizeBlogName(c.blogName)}` : '@unknown'}</b>: ${c.body}</span><span class="ts">${formatDate(c.createdAtUnix, 'friendly')}</span></div>`)}</div>`;
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
        
        <div class="stats-bar">
          <button class="stat-btn ${this.activeTab === 'likes' ? 'active' : ''}" @click=${() => this.toggleTab('likes')}>❤️ ${p.likesCount || 0}</button>
          <button class="stat-btn ${this.activeTab === 'reblogs' ? 'active' : ''}" @click=${() => this.toggleTab('reblogs')}>♻️ ${p.reblogsCount || 0}</button>
          <button class="stat-btn ${this.activeTab === 'comments' ? 'active' : ''}" @click=${() => this.toggleTab('comments')}>💬 ${p.commentsCount || 0}</button>
        </div>

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
