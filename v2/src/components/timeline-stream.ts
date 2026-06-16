import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { format } from 'date-fns';
import { baseStyles } from '../styles/theme.js';
import type { ProcessedPost } from '../types/post.js';
import type { TimelineItem } from '../types/api.js';
import { DEFAULT_ACTIVITY_KINDS, type ActivityKind } from '../services/profile.js';
import { buildRenderableTimelineItems, type ActivityRunBucket } from '../services/timeline-rendering.js';
import '../components/post-feed-item.js';
import '../components/activity-grid.js';
import '../components/result-group.js';

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
  @property({ type: String }) interactionGroupingMode: 'date' | 'date+actor' = 'date';
  @property({ type: String }) activityCardVariant: 'self-context' | 'actor-context' = 'self-context';
  @property({ type: String }) page: 'feed' | 'follower-feed' | 'activity' = 'feed';
  @property({ type: String }) viewedBlogName = '';
  @state() private clusterVisibleCounts = new Map<string, number>();
  private readonly clusterPageSize = 12;

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
    const from = this.page === 'follower-feed' ? 'follower-feed' : this.page;
    this.dispatchEvent(new CustomEvent('post-click', {
      detail: { post, posts, index: index >= 0 ? index : 0, from },
      bubbles: true,
      composed: true,
    }));
  }

  private getDateKey(unix: number): string {
    const ts = unix;
    if (!ts) return 'unknown-date';
    return format(new Date(ts * 1000), 'yyyy-MM-dd');
  }


  private get presentationPage(): 'feed' | 'activity' {
    return this.page === 'follower-feed' ? 'feed' : this.page;
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

  private renderActivityBucket(bucket: ActivityRunBucket) {
    const visibleCount = this.getVisibleCount(bucket.key, bucket.interactions.length);
    const visibleItems = bucket.interactions.slice(0, visibleCount);
    const remaining = bucket.interactions.length - visibleItems.length;
    const actorSuffix = this.interactionGroupingMode === 'date+actor' && bucket.actor ? ` by @${bucket.actor}` : '';
    const oldestDate = this.getDateKey(bucket.oldestInteractionUnix || bucket.latestInteractionUnix);
    const newestDate = this.getDateKey(bucket.latestInteractionUnix || bucket.oldestInteractionUnix);
    const dateLabel = oldestDate === newestDate
      ? `Activity on ${newestDate}`
      : `Activity from ${oldestDate} to ${newestDate}`;
    const countParts = [
      bucket.likeCount ? `❤️ ${bucket.likeCount}` : '',
      bucket.commentCount ? `💬 ${bucket.commentCount}` : '',
    ].filter(Boolean);
    const label = `${dateLabel}${countParts.length ? ` : ${countParts.join(' . ')}` : ''}${actorSuffix}`;
    return html`
      <result-group
        .label=${label}
        .remaining=${remaining}
        @result-group-load-more=${() => this.loadMoreInCluster(bucket.key)}
      >
        <activity-grid
          compact
          .items=${visibleItems}
          .showBlogChip=${true}
          .activityCardVariant=${this.activityCardVariant}
          .viewedBlogName=${this.viewedBlogName}
          @activity-click=${(e: CustomEvent) => this.handlePostClick(e.detail.post)}
        ></activity-grid>
      </result-group>
    `;
  }

  render() {
    const renderable = buildRenderableTimelineItems({
      items: this.items,
      activityKinds: this.activityKinds,
      interactionGroupingMode: this.interactionGroupingMode,
      activityCardVariant: this.activityCardVariant,
      presentationPage: this.presentationPage,
      viewedBlogName: this.viewedBlogName,
    });
    return html`
      <div class="stream">
        ${renderable.map((item) => {
          if (item.type === 'post') {
            return html`
              <post-feed-item
                .post=${item.post}
                .page=${this.page}
                .showActions=${this.page === 'activity' || this.page === 'feed' || this.page === 'follower-feed'}
                @post-select=${(e: CustomEvent) => this.handlePostClick(e.detail.post)}
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
