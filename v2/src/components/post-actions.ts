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
        gap: 10px;
        width: 100%;
        flex-wrap: wrap;
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

      .actions-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        min-width: 0;
      }

      .action-group {
        display: inline-flex;
        align-items: center;
        gap: 6px;
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

      .count-chip-button {
        cursor: pointer;
        transition: border-color 0.15s ease, transform 0.15s ease, color 0.15s ease;
      }

      .count-chip-button:hover {
        border-color: var(--accent);
        color: var(--text);
        transform: translateY(-1px);
      }

      .actions.detail .count-chip {
        background: transparent;
      }

      .icon-btn {
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text);
        border-radius: 999px;
        min-width: 34px;
        min-height: 34px;
        padding: 0 10px;
        font-size: 16px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color 0.15s ease, transform 0.15s ease, background 0.15s ease;
        flex-shrink: 0;
      }

      .icon-btn:hover {
        border-color: var(--accent);
        transform: translateY(-1px);
      }

      .icon-btn.liked,
      .icon-btn.reblogged {
        background: color-mix(in srgb, var(--accent) 18%, var(--bg-panel-alt));
        border-color: var(--accent);
      }

      .icon-btn:disabled {
        cursor: default;
        opacity: 0.7;
      }

      .comment-btn {
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

      .comment-btn:hover {
        border-color: var(--accent);
        transform: translateY(-1px);
      }

      .comment-btn:disabled {
        cursor: default;
        opacity: 0.7;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        padding: 16px;
      }

      .modal {
        width: min(480px, 100%);
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .modal h3 {
        margin: 0;
        font-size: 16px;
      }

      .modal p {
        margin: 0;
        color: var(--text-muted);
        font-size: 13px;
      }

      .composer {
        width: 100%;
        min-height: 120px;
        resize: vertical;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg-primary);
        color: var(--text);
        font: inherit;
      }

      .composer:disabled {
        opacity: 0.75;
        cursor: default;
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .modal-error {
        color: var(--error, #ff6b6b);
        font-size: 13px;
      }
    `,
  ];

  @property({ type: Object }) post: ProcessedPost | null = null;
  @property({ type: String }) variant: 'card' | 'detail' = 'card';

  @state() private likeState: boolean | undefined = undefined;
  @state() private reblogCount: number | undefined = undefined;
  @state() private commentCount: number | undefined = undefined;
  @state() private syncing = false;
  @state() private reblogging = false;
  @state() private commentModalOpen = false;
  @state() private commentBody = '';
  @state() private commenting = false;
  @state() private commentError: string | null = null;
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
      this.commentModalOpen = false;
      this.commentBody = '';
      this.commentError = null;
      void this.syncActorState();
    }
  }

  private openEngagementTab(tab: 'likes' | 'reblogs' | 'comments', event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent('engagement-open-tab', {
      detail: { tab },
      bubbles: true,
      composed: true,
    }));
  }

  private async syncActorState(): Promise<void> {
    const post = this.post;
    const actor = getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId ?? null;
    if (!post || !actor) {
      this.likeState = undefined;
      this.reblogCount = undefined;
      this.commentCount = post?.commentsCount ?? 0;
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
      this.commentCount = engagementState.getCommentCount(currentPostId) ?? post.commentsCount ?? 0;
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

  private openCommentModal(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.post || this.commenting) {
      return;
    }

    this.commentModalOpen = true;
    this.commentBody = '';
    this.commentError = null;
  }

  private closeCommentModal(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.commenting) {
      return;
    }

    this.commentModalOpen = false;
    this.commentBody = '';
    this.commentError = null;
  }

  private async submitComment(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const post = this.post;
    if (!post || this.commenting) {
      return;
    }

    const comment = this.commentBody.trim();
    if (!comment) {
      this.commentError = 'Enter a comment before submitting.';
      return;
    }

    const previousCommentCount = this.commentCount ?? post.commentsCount ?? 0;
    this.commenting = true;
    this.commentError = null;
    this.commentCount = previousCommentCount + 1;

    try {
      await engagementState.commentPost(post.id, comment);
      this.commentCount = engagementState.getCommentCount(post.id) ?? previousCommentCount + 1;
      this.commentModalOpen = false;
      this.commentBody = '';
    } catch (error) {
      console.error('Failed to comment post', error);
      this.commentCount = engagementState.getCommentCount(post.id) ?? previousCommentCount;
      this.commentError = error instanceof Error ? error.message : 'Failed to submit comment';
    } finally {
      this.commenting = false;
    }
  }

  private renderCounts() {
    const post = this.post;
    if (!post) return nothing;
    const likeCount = post.likesCount ?? 0;
    const reblogCount = post.reblogsCount ?? 0;
    const commentCount = this.commentCount ?? post.commentsCount ?? 0;
    return html`
      <div class="actions-row">
        <div class="action-group">
          <button
            class="icon-btn ${reblogCount > 0 ? 'reblogged' : ''}"
            type="button"
            aria-pressed=${reblogCount > 0 ? 'true' : 'false'}
            title=${reblogCount > 0 ? 'Reblogged' : 'Reblog'}
            ?disabled=${!Boolean(getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId) || this.syncing}
            @click=${this.triggerReblog}
          >
            ${this.reblogging ? '⟳' : '♻️'}
          </button>
          ${reblogCount > 0 ? html`
            <button class="count-chip count-chip-button" type="button" @click=${(event: Event) => this.openEngagementTab('reblogs', event)}>
              ${reblogCount}
            </button>
          ` : nothing}
        </div>
        <div class="action-group">
          <button
            class="icon-btn"
            type="button"
            title="Comment"
            ?disabled=${!Boolean(getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId) || this.syncing}
            @click=${this.openCommentModal}
          >
            💬
          </button>
          <button class="count-chip count-chip-button" type="button" @click=${(event: Event) => this.openEngagementTab('comments', event)}>
            ${commentCount}
          </button>
        </div>
        <div class="action-group">
          <button
            class="icon-btn ${this.likeState ? 'liked' : ''}"
            type="button"
            aria-pressed=${this.likeState ? 'true' : 'false'}
            title=${this.likeState ? 'Liked' : 'Like'}
            ?disabled=${!Boolean(getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId) || this.syncing}
            @click=${this.toggleLike}
          >
            ${this.likeState ? '❤️' : '🤍'}
          </button>
          ${likeCount > 0 ? html`
            <button class="count-chip count-chip-button" type="button" @click=${(event: Event) => this.openEngagementTab('likes', event)}>
              ${likeCount}
            </button>
          ` : nothing}
        </div>
      </div>
    `;
  }

  private renderCommentModal() {
    if (!this.commentModalOpen || !this.post) {
      return nothing;
    }

    const trimmed = this.commentBody.trim();

    return html`
      <div class="modal-backdrop" @click=${this.closeCommentModal}>
        <section class="modal" role="dialog" aria-modal="true" aria-label="Comment composer" @click=${(event: Event) => event.stopPropagation()}>
          <h3>Comment on post</h3>
          <p>Use the active blog to create a comment with a plain textarea composer.</p>
          <textarea
            class="composer"
            placeholder="Write a comment..."
            .value=${this.commentBody}
            ?disabled=${this.commenting}
            @input=${(event: Event) => {
              this.commentBody = (event.target as HTMLTextAreaElement).value;
              if (this.commentError) {
                this.commentError = null;
              }
            }}
          ></textarea>
          ${this.commentError ? html`<div class="modal-error">${this.commentError}</div>` : ''}
          <div class="modal-actions">
            <button type="button" class="comment-btn" ?disabled=${this.commenting} @click=${this.closeCommentModal}>Cancel</button>
            <button type="button" class="comment-btn" ?disabled=${this.commenting || !trimmed} @click=${this.submitComment}>
              ${this.commenting ? '💬 Sending…' : '💬 Submit'}
            </button>
          </div>
        </section>
      </div>
    `;
  }

  render() {
    const post = this.post;
    if (!post) return nothing;

    const isDetail = this.variant === 'detail';

    return html`
      <div class="actions ${isDetail ? 'detail' : 'card'}">
        ${this.renderCounts()}
      </div>
      ${this.renderCommentModal()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-actions': PostActions;
  }
}
