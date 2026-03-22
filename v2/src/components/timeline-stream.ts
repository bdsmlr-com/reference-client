import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import type { TimelineItem } from '../types/api.js';
import type { ActivityKind } from '../services/profile.js';
import '../components/post-feed-item.js';
import '../components/activity-grid.js';

@customElement('timeline-stream')
export class TimelineStream extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; }
      .stream { max-width: 600px; margin: 0 auto; }
      .interaction-cluster {
        max-width: 600px;
        margin: 0 auto 20px auto;
        background: var(--bg-panel-alt);
        padding: 12px;
        border-radius: 8px;
        border: 1px solid var(--border);
      }
      .cluster-label {
        font-size: 12px;
        color: var(--text-muted);
        margin-bottom: 8px;
        font-weight: 600;
      }
    `,
  ];

  @property({ type: Array }) items: TimelineItem[] = [];
  @property({ type: Array }) activityKinds: ActivityKind[] = ['post', 'reblog', 'like', 'comment'];
  @property({ type: Boolean }) showActorInCluster = false;

  private inferItemKind(item: TimelineItem): ActivityKind {
    if (item.type === 1 && item.post) {
      const p = item.post as ProcessedPost;
      if (p.variant === 2) return 'reblog';
      return p.originPostId && p.originPostId !== p.id ? 'reblog' : 'post';
    }
    if (item.type === 2 && item.cluster) {
      const label = (item.cluster.label || '').toLowerCase();
      if (label.includes('comment')) return 'comment';
      if (label.includes('reblog')) return 'reblog';
      return 'like';
    }
    return 'post';
  }

  private getAllPosts(): ProcessedPost[] {
    const all: ProcessedPost[] = [];
    this.items.forEach((item) => {
      if (item.type === 1 && item.post) {
        all.push(item.post as ProcessedPost);
      } else if (item.type === 2 && item.cluster) {
        (item.cluster.interactions || []).forEach((p) => all.push(p as ProcessedPost));
      }
    });
    return all;
  }

  private handlePostClick(post: ProcessedPost): void {
    const posts = this.getAllPosts();
    const index = posts.findIndex((p) => p.id === post.id);
    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post, posts, index: index >= 0 ? index : 0 },
      bubbles: true,
      composed: true,
    }));
  }

  private renderClusterLabel(item: TimelineItem, kind: ActivityKind): string {
    const base = item.cluster?.label || (kind === 'comment' ? 'Comments' : 'Likes');
    if (!this.showActorInCluster) return base;
    const actor = (item.cluster?.interactions?.[0] as ProcessedPost | undefined)?.blogName || '';
    return actor ? `${base} by @${actor}` : base;
  }

  render() {
    return html`
      <div class="stream">
        ${this.items.map((item) => {
          const kind = this.inferItemKind(item);
          if (!this.activityKinds.includes(kind)) {
            return '';
          }

          if (item.type === 1 && item.post) {
            const post = item.post as ProcessedPost;
            return html`<post-feed-item .post=${post} @post-select=${(e: CustomEvent) => this.handlePostClick(e.detail.post)}></post-feed-item>`;
          }

          if (item.type === 2 && item.cluster) {
            return html`
              <div class="interaction-cluster">
                <div class="cluster-label">${this.renderClusterLabel(item, kind)}</div>
                <activity-grid
                  compact
                  .items=${(item.cluster.interactions || []).map((p) => ({ post: p, type: kind }))}
                  @activity-click=${(e: CustomEvent) => this.handlePostClick(e.detail.post)}
                ></activity-grid>
              </div>
            `;
          }

          return '';
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'timeline-stream': TimelineStream;
  }
}
