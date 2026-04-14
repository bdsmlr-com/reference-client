import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { createEngagementStateController } from '../services/engagement-state.js';
import { getAuthUser } from '../state/auth-state.js';
import type { ProcessedPost } from '../types/post.js';

const engagementState = createEngagementStateController(apiClient.engagement);

@customElement('post-actions')
export class PostActions extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
      }

      .actions.card {
        padding: 0;
      }

      .actions.detail {
        background: var(--bg-panel-alt);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px 12px;
      }

      .counts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        min-width: 0;
      }

      .count-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--bg-panel-alt);
        border: 1px solid var(--border);
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        color: var(--text-muted);
        white-space: nowrap;
      }

      .actions.detail .count-chip {
        background: transparent;
      }

      .like-btn {
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: border-color 0.15s ease, transform 0.15s ease, background 0.15s ease;
        flex-shrink: 0;
      }

      .like-btn:hover {
        border-color: var(--accent);
        transform: translateY(-1px);
      }

      .like-btn.liked {
        background: color-mix(in srgb, var(--accent) 18%, var(--bg-panel-alt));
        border-color: var(--accent);
      }

      .like-btn:disabled {
        cursor: default;
        opacity: 0.7;
      }

      .buttons {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .reblog-btn {
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: border-color 0.15s ease, transform 0.15s ease, background 0.15s ease;
        flex-shrink: 0;
      }

      .reblog-btn:hover {
        border-color: var(--accent);
        transform: translateY(-1px);
      }
    `,
  ];

  @property({ type: Object }) post: ProcessedPost | null = null;
  @property({ type: String }) variant: 'card' | 'detail' = 'card';

  @state() private likeState: boolean | undefined = undefined;
  @state() private reblogCount: number | undefined = undefined;
  @state() private syncing = false;
  @state() private reblogging = false;
  private syncRequestId = 0;
  private unsubscribeLikeState: (() => void) | null = null;

  private readonly handleSharedStateChanged = () => {
    void this.syncActorState();
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribeLikeState = engagementState.subscribe(this.handleSharedStateChanged);
    void this.syncActorState();
  }

  disconnectedCallback(): void {
    this.unsubscribeLikeState?.();
    this.unsubscribeLikeState = null;
    super.disconnectedCallback();
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('post') || changedProperties.has('variant')) {
      void this.syncActorState();
    }
  }

  private getCountLabel(value: number | undefined, label: string): string | null {
    const count = value ?? 0;
    if (!count) return null;
    return `${label} ${count}`;
  }

  private async syncActorState(): Promise<void> {
    const post = this.post;
    const actor = getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId ?? null;
    if (!post || !actor) {
      this.likeState = undefined;
      this.reblogCount = undefined;
      this.syncing = false;
      return;
    }

    const requestId = ++this.syncRequestId;
    this.syncing = true;
    const currentPostId = post.id;
    try {
      await engagementState.hydrateLikeStates([currentPostId]);
      await engagementState.hydrateReblogStates([currentPostId]);
      if (requestId !== this.syncRequestId || !this.post || this.post.id !== currentPostId) {
        return;
      }
      this.likeState = engagementState.getLikeState(currentPostId);
      if (this.likeState === undefined) {
        this.likeState = false;
      }
      this.reblogCount = engagementState.getReblogCount(currentPostId) ?? 0;
    } finally {
      if (requestId === this.syncRequestId) {
        this.syncing = false;
      }
    }
  }

  private async toggleLike(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const post = this.post;
    if (!post) return;

    const nextLikeState = !this.likeState;
    this.likeState = nextLikeState;
    try {
      if (nextLikeState) {
        await engagementState.likePost(post.id);
      } else {
        await engagementState.unlikePost(post.id);
      }
      this.likeState = engagementState.getLikeState(post.id) ?? false;
    } catch (error) {
      console.error('Failed to toggle like state', error);
      this.likeState = engagementState.getLikeState(post.id) ?? !nextLikeState;
    }
  }

  private async triggerReblog(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const post = this.post;
    if (!post) return;

    const previousReblogCount = this.reblogCount ?? 0;
    this.reblogging = true;
    this.reblogCount = previousReblogCount + 1;
    try {
      await engagementState.reblogPost(post.id);
      this.reblogCount = engagementState.getReblogCount(post.id) ?? previousReblogCount + 1;
    } catch (error) {
      console.error('Failed to reblog post', error);
      this.reblogCount = engagementState.getReblogCount(post.id) ?? previousReblogCount;
    } finally {
      this.reblogging = false;
    }
  }

  private renderCounts() {
    const post = this.post;
    if (!post) return nothing;
    return html`
      <div class="counts">
        ${this.getCountLabel(post.likesCount, '❤️') ? html`<span class="count-chip">${this.getCountLabel(post.likesCount, '❤️')}</span>` : ''}
        ${this.getCountLabel(post.reblogsCount, '♻️') ? html`<span class="count-chip">${this.getCountLabel(post.reblogsCount, '♻️')}</span>` : ''}
        ${this.getCountLabel(post.commentsCount, '💬') ? html`<span class="count-chip">${this.getCountLabel(post.commentsCount, '💬')}</span>` : ''}
      </div>
    `;
  }

  render() {
    const post = this.post;
    if (!post) return nothing;

    const isDetail = this.variant === 'detail';
    const liked = Boolean(this.likeState);
    const reblogCount = this.reblogCount ?? 0;
    const actorAvailable = Boolean(getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId);

    return html`
      <div class="actions ${isDetail ? 'detail' : 'card'}">
        ${this.renderCounts()}
        <div class="buttons">
          ${reblogCount > 0 ? html`<span class="count-chip">You reblogged ${reblogCount}x</span>` : nothing}
          <button
            class="reblog-btn"
            type="button"
            ?disabled=${!actorAvailable}
            @click=${this.triggerReblog}
          >
            ${this.reblogging ? '♻️ Reblogging…' : '♻️ Reblog'}
          </button>
          <button
            class="like-btn ${liked ? 'liked' : ''}"
            type="button"
            aria-pressed=${liked ? 'true' : 'false'}
            ?disabled=${!actorAvailable || this.syncing}
            @click=${this.toggleLike}
          >
            ${liked ? '❤️ Unlike' : '🤍 Like'}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-actions': PostActions;
  }
}
