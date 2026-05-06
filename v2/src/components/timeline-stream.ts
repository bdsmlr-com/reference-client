import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { format } from 'date-fns';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import type { TimelineItem } from '../types/api.js';
import { DEFAULT_ACTIVITY_KINDS, type ActivityKind } from '../services/profile.js';
import { buildInteractionHandler } from '../services/render-interactions.js';
import { loadRenderContract } from '../services/render-contract.js';
import { toPresentationModel } from '../services/post-presentation.js';
import '../components/post-feed-item.js';
import '../components/activity-grid.js';
import '../components/result-group.js';

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
  | { type: 'activity-bucket'; bucket: DateActivityBucket };

@customElement('timeline-stream')
export class TimelineStream extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; }
      .stream { max-width: 600px; margin: 0 auto; }
    `,
  ];

  @property({ type: Array }) items: TimelineItem[] = [];
  @property({ type: Array }) activityKinds: ActivityKind[] = [...DEFAULT_ACTIVITY_KINDS];
  @property({ type: Boolean }) showActorInCluster = false;
  @property({ type: String }) page: 'feed' | 'follower-feed' | 'activity' = 'feed';
  @state() private clusterVisibleCounts = new Map<string, number>();
  private readonly clusterPageSize = 12;
  private readonly openLightboxInteraction = buildInteractionHandler((loadRenderContract().interactions as any).open_lightbox_post);

  private inferItemKind(item: TimelineItem): ActivityKind {
    if (item.type === 1 && item.post) {
      const p = item.post as ProcessedPost;
      if (p._activityKindOverride) return p._activityKindOverride;
      const presentation = toPresentationModel(p, { surface: 'timeline', page: this.presentationPage });
      return presentation.identity.isReblog ? 'reblog' : 'post';
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
    this.openLightboxInteraction({
      host: this,
      payload: { post, posts, index: index >= 0 ? index : 0 },
    });
  }

  private getDateKey(post: ProcessedPost): string {
    const ts = this.getInteractionUnix(post);
    if (!ts) return 'unknown-date';
    return format(new Date(ts * 1000), 'yyyy-MM-dd');
  }

  private getInteractionUnix(post: ProcessedPost): number {
    return post._activityCreatedAtUnix || post.updatedAtUnix || post.createdAtUnix || 0;
  }

  private getViewedBlogFromPath(): string {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return '';
    return parts[0].toLowerCase();
  }

  private normalizeBlogName(name: string | undefined): string {
    return (name || '').trim().toLowerCase();
  }

  private get presentationPage(): 'feed' | 'activity' {
    return this.page === 'follower-feed' ? 'feed' : this.page;
  }

  private shouldSuppressSelfSameDayLike(post: ProcessedPost, kind: ActivityKind): boolean {
    if (kind !== 'like' || this.showActorInCluster) return false;
    const presentation = toPresentationModel(post, { surface: 'timeline', page: this.presentationPage, interactionKind: kind });
    if (!presentation.identity.allowSelfSameDayLikeSuppression) return false;

    const viewedBlog = this.getViewedBlogFromPath();
    if (!viewedBlog) return false;

    const ownerBlog = this.normalizeBlogName(post.blogName);
    if (!ownerBlog || ownerBlog !== viewedBlog) return false;

    const postDateKey = post.createdAtUnix ? format(new Date(post.createdAtUnix * 1000), 'yyyy-MM-dd') : '';
    const interactionDateKey = this.getDateKey(post);
    return Boolean(postDateKey) && postDateKey === interactionDateKey;
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
            renderable.push({
              type: 'post',
              post: {
                ...post,
                _activityCreatedAtUnix: this.getInteractionUnix(post),
              },
            });
          }
          continue;
        }
        if (kind !== 'like' && kind !== 'comment') continue;

        for (const raw of (item.cluster.interactions || [])) {
          const post = raw as ProcessedPost;
          const dateKey = this.getDateKey(post);
          if (this.shouldSuppressSelfSameDayLike(post, kind)) {
            continue;
          }
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
          const interactionUnix = this.getInteractionUnix(post);
          if (interactionUnix > bucket.latestInteractionUnix) {
            bucket.latestInteractionUnix = interactionUnix;
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
      return item.post._activityCreatedAtUnix || item.post.createdAtUnix || 0;
    }
    if (item.type === 'activity-bucket') {
      return item.bucket.latestInteractionUnix || 0;
    }
    return 0;
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
    const label = `Activity on ${bucket.dateKey} : ❤️ ${bucket.likeCount} . 💬 ${bucket.commentCount}${actorSuffix}`;
    return html`
      <result-group
        .label=${label}
        .remaining=${remaining}
        @result-group-load-more=${() => this.loadMoreInCluster(bucket.key)}
      >
        <activity-grid
          compact
          .items=${visibleItems}
          .showBlogChip=${!this.showActorInCluster}
          @activity-click=${(e: CustomEvent) => this.handlePostClick(e.detail.post)}
        ></activity-grid>
      </result-group>
    `;
  }

  render() {
    const renderable = this.getRenderableItems();
    return html`
      <div class="stream">
        ${renderable.map((item) => {
          if (item.type === 'post') {
            return html`
              <post-feed-item
                .post=${item.post}
                .page=${this.page}
                @post-click=${(e: CustomEvent) => this.handlePostClick(e.detail.post)}
                @click=${() => this.handlePostClick(item.post)}
              ></post-feed-item>
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
