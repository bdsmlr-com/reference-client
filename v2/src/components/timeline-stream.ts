import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { format } from 'date-fns';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import type { TimelineItem } from '../types/api.js';
import type { ActivityKind } from '../services/profile.js';
import '../components/post-feed-item.js';
import '../components/activity-grid.js';

type BucketInteraction = {
  post: ProcessedPost;
  type: 'like' | 'comment';
};

type DateActivityBucket = {
  key: string;
  dateKey: string;
  actor: string;
  likeCount: number;
  commentCount: number;
  latestInteractionUnix: number;
  interactions: BucketInteraction[];
  interactionIndex: Map<number, number>;
};

type RenderableItem =
  | { type: 'post'; post: ProcessedPost }
  | { type: 'legacy-cluster'; label: string; kind: ActivityKind; interactions: ProcessedPost[] }
  | { type: 'activity-bucket'; bucket: DateActivityBucket };

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
      .cluster-actions {
        margin-top: 8px;
        display: flex;
        justify-content: center;
      }
      .load-more {
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: var(--text);
        font-size: 12px;
        border-radius: 999px;
        padding: 4px 10px;
        cursor: pointer;
      }
      .load-more:hover {
        border-color: var(--accent);
      }
    `,
  ];

  @property({ type: Array }) items: TimelineItem[] = [];
  @property({ type: Array }) activityKinds: ActivityKind[] = ['post', 'reblog', 'like', 'comment'];
  @property({ type: Boolean }) showActorInCluster = false;
  @state() private clusterVisibleCounts = new Map<string, number>();
  private readonly clusterPageSize = 12;

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

  private getDateKey(post: ProcessedPost): string {
    if (!post.createdAtUnix) return 'unknown-date';
    return format(new Date(post.createdAtUnix * 1000), 'yyyy-MM-dd');
  }

  private getRenderableItems(): RenderableItem[] {
    const renderable: RenderableItem[] = [];
    const buckets = new Map<string, DateActivityBucket>();
    for (const item of this.items) {
      const kind = this.inferItemKind(item);
      if (!this.activityKinds.includes(kind)) continue;

      if (item.type === 1 && item.post) {
        renderable.push({ type: 'post', post: item.post as ProcessedPost });
        continue;
      }

      if (item.type === 2 && item.cluster) {
        if (kind === 'reblog') {
          for (const raw of (item.cluster.interactions || [])) {
            const post = raw as ProcessedPost;
            renderable.push({ type: 'post', post });
          }
          continue;
        }
        if (kind !== 'like' && kind !== 'comment') {
          renderable.push({
            type: 'legacy-cluster',
            label: this.renderClusterLabel(item, kind),
            kind,
            interactions: (item.cluster.interactions || []) as ProcessedPost[],
          });
          continue;
        }

        for (const raw of (item.cluster.interactions || [])) {
          const post = raw as ProcessedPost;
          const dateKey = this.getDateKey(post);
          const actor = this.showActorInCluster ? (post.blogName || '') : '';
          const key = actor ? `${dateKey}::${actor}` : dateKey;
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = {
              key,
              dateKey,
              actor,
              likeCount: 0,
              commentCount: 0,
              latestInteractionUnix: 0,
              interactions: [],
              interactionIndex: new Map<number, number>(),
            };
            buckets.set(key, bucket);
            renderable.push({ type: 'activity-bucket', bucket });
          }
          if (post.createdAtUnix && post.createdAtUnix > bucket.latestInteractionUnix) {
            bucket.latestInteractionUnix = post.createdAtUnix;
          }
          if (kind === 'like') bucket.likeCount += 1;
          if (kind === 'comment') bucket.commentCount += 1;
          if (!Number.isFinite(post.id)) {
            bucket.interactions.push({ post, type: kind });
            continue;
          }
          const postId = post.id;
          const existingIndex = bucket.interactionIndex.get(postId);
          if (existingIndex === undefined) {
            bucket.interactionIndex.set(postId, bucket.interactions.length);
            bucket.interactions.push({ post, type: kind });
          } else if (kind === 'comment' && bucket.interactions[existingIndex].type === 'like') {
            // If a post has both interactions, prefer comment icon on the single rendered tile.
            bucket.interactions[existingIndex] = { post, type: 'comment' };
          }
        }
      }
    }

    renderable.sort((a, b) => this.getRenderableTimestamp(b) - this.getRenderableTimestamp(a));
    return renderable;
  }

  private getRenderableTimestamp(item: RenderableItem): number {
    if (item.type === 'post') {
      return item.post.createdAtUnix || 0;
    }
    if (item.type === 'activity-bucket') {
      return item.bucket.latestInteractionUnix || 0;
    }
    const first = item.interactions[0];
    return first?.createdAtUnix || 0;
  }

  private getVisibleCount(key: string, total: number): number {
    if (!this.clusterVisibleCounts.has(key)) {
      this.clusterVisibleCounts.set(key, this.clusterPageSize);
    }
    const visible = this.clusterVisibleCounts.get(key) || this.clusterPageSize;
    return Math.min(visible, total);
  }

  private loadMoreInCluster(key: string): void {
    const current = this.clusterVisibleCounts.get(key) || this.clusterPageSize;
    this.clusterVisibleCounts.set(key, current + this.clusterPageSize);
    this.requestUpdate();
  }

  private renderActivityBucket(bucket: DateActivityBucket) {
    const visibleCount = this.getVisibleCount(bucket.key, bucket.interactions.length);
    const visibleItems = bucket.interactions.slice(0, visibleCount);
    const remaining = bucket.interactions.length - visibleItems.length;
    const actorSuffix = this.showActorInCluster && bucket.actor ? ` by @${bucket.actor}` : '';
    return html`
      <div class="interaction-cluster">
        <div class="cluster-label">Activity on ${bucket.dateKey} : ❤️ ${bucket.likeCount} . 💬 ${bucket.commentCount}${actorSuffix}</div>
        <activity-grid
          compact
          .items=${visibleItems}
          @activity-click=${(e: CustomEvent) => this.handlePostClick(e.detail.post)}
        ></activity-grid>
        ${remaining > 0 ? html`
          <div class="cluster-actions">
            <button class="load-more" type="button" @click=${() => this.loadMoreInCluster(bucket.key)}>Load more (${remaining})</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  render() {
    const renderable = this.getRenderableItems();
    return html`
      <div class="stream">
        ${renderable.map((item) => {
          if (item.type === 'post') {
            return html`<post-feed-item .post=${item.post} @post-click=${(e: CustomEvent) => this.handlePostClick(e.detail.post)}></post-feed-item>`;
          }
          if (item.type === 'legacy-cluster') {
            return html`
              <div class="interaction-cluster">
                <div class="cluster-label">${item.label}</div>
                <activity-grid
                  compact
                  .items=${item.interactions.map((p) => ({ post: p, type: item.kind }))}
                  @activity-click=${(e: CustomEvent) => this.handlePostClick(e.detail.post)}
                ></activity-grid>
              </div>
            `;
          }
          return this.renderActivityBucket(item.bucket);
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
