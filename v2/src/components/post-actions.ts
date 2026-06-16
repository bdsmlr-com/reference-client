import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { createEngagementStateController } from '../services/engagement-state.js';
import { toPresentationModel } from '../services/post-presentation.js';
import { getAuthUser } from '../state/auth-state.js';
import { deletePost as deletePostRequest } from '../services/api.js';
import { buildPageUrl } from '../services/blog-resolver.js';
import { FEATURE_FLAGS } from '../config.js';
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
        color: var(--text);
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

      .count-chip.has-activity {
        background: color-mix(in srgb, var(--text-muted) 14%, var(--bg-panel-alt));
        border-color: color-mix(in srgb, var(--text-muted) 30%, var(--border));
        color: var(--text);
      }

      .count-chip.like-active {
        background: color-mix(in srgb, #e85d75 16%, var(--bg-panel-alt));
        border-color: color-mix(in srgb, #e85d75 34%, var(--border));
        color: #e85d75;
      }

      .count-chip.reblog-active {
        background: color-mix(in srgb, #57b89a 16%, var(--bg-panel-alt));
        border-color: color-mix(in srgb, #57b89a 34%, var(--border));
        color: #57b89a;
      }

      .count-chip.comment-active {
        background: color-mix(in srgb, #8d97a8 16%, var(--bg-panel-alt));
        border-color: color-mix(in srgb, #8d97a8 34%, var(--border));
        color: var(--text);
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

      .icon-btn.is-active {
        background: color-mix(in srgb, var(--text-muted) 14%, var(--bg-panel-alt));
        border-color: color-mix(in srgb, var(--text-muted) 30%, var(--border));
      }

      .icon-btn.like-active {
        background: color-mix(in srgb, #e85d75 16%, var(--bg-panel-alt));
        border-color: color-mix(in srgb, #e85d75 34%, var(--border));
        color: #e85d75;
      }

      .icon-btn.reblog-active {
        background: color-mix(in srgb, #57b89a 16%, var(--bg-panel-alt));
        border-color: color-mix(in srgb, #57b89a 34%, var(--border));
        color: #57b89a;
      }

      .icon-btn.comment-active {
        background: color-mix(in srgb, #8d97a8 16%, var(--bg-panel-alt));
        border-color: color-mix(in srgb, #8d97a8 34%, var(--border));
        color: var(--text);
      }

      .icon-btn:disabled {
        cursor: default;
        opacity: 0.7;
      }

      .comment-btn,
      .danger-btn {
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

      .comment-btn:hover,
      .danger-btn:hover {
        border-color: var(--accent);
        transform: translateY(-1px);
      }

      .comment-btn:disabled,
      .danger-btn:disabled {
        cursor: default;
        opacity: 0.7;
      }

      .danger-btn {
        color: #f58f8f;
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

      .modal-note {
        color: var(--text-muted);
        font-size: 12px;
      }

      .tags-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tags-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
      }

      .tags-shell {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: var(--bg-primary);
      }

      .tag-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
        background: color-mix(in srgb, var(--accent) 12%, var(--bg-panel-alt));
        color: var(--text);
        font-size: 12px;
        line-height: 1;
      }

      .tag-chip-remove {
        border: none;
        background: transparent;
        color: inherit;
        padding: 0;
        margin: 0;
        cursor: pointer;
        font: inherit;
        line-height: 1;
      }

      .tag-input {
        flex: 1 1 160px;
        min-width: 120px;
        border: none;
        outline: none;
        background: transparent;
        color: var(--text);
        font: inherit;
      }

      .tag-input:disabled {
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
  @state() private liking = false;
  @state() private reblogging = false;
  @state() private commentModalOpen = false;
  @state() private commentBody = '';
  @state() private commenting = false;
  @state() private commentError: string | null = null;
  @state() private reblogComposerOpen = false;
  @state() private reblogNote = '';
  @state() private reblogTagInput = '';
  @state() private reblogTags: string[] = [];
  @state() private reblogError: string | null = null;
  @state() private reblogSubmitting = false;
  @state() private deleting = false;
  private syncRequestId = 0;
  private unsubscribeLikeState: (() => void) | null = null;

  private readonly handleSharedStateChanged = () => {
    this.syncLocalStateFromCache();
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribeLikeState = engagementState.subscribe(this.handleSharedStateChanged);
    this.syncLocalStateFromCache();
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
      this.resetReblogComposer();
      this.syncLocalStateFromCache();
    }
    if (changedProperties.has('reblogComposerOpen') && this.reblogComposerOpen) {
      requestAnimationFrame(() => {
        const textarea = this.shadowRoot?.querySelector<HTMLTextAreaElement>('.reblog-note');
        textarea?.focus();
      });
    }
  }

  private resetReblogComposer(): void {
    this.reblogComposerOpen = false;
    this.reblogNote = '';
    this.reblogTagInput = '';
    this.reblogTags = [];
    this.reblogError = null;
    this.reblogSubmitting = false;
  }

  private normalizeReblogTag(raw: string): string | null {
    const normalized = raw.trim().replace(/^#+/, '').trim();
    if (!normalized) return null;
    const duplicate = this.reblogTags.some((tag) => tag.localeCompare(normalized, undefined, { sensitivity: 'base' }) === 0);
    return duplicate ? null : normalized;
  }

  private commitReblogTag(raw: string): void {
    const normalized = this.normalizeReblogTag(raw);
    if (!normalized) {
      return;
    }
    this.reblogTags = [...this.reblogTags, normalized];
  }

  private flushReblogTagInput(): string[] {
    if (this.reblogTagInput.trim()) {
      this.commitReblogTag(this.reblogTagInput);
      this.reblogTagInput = '';
    }
    return [...this.reblogTags];
  }

  private syncLocalStateFromCache(): void {
    const post = this.post;
    const actor = getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId ?? null;
    if (!post || !actor) {
      this.likeState = undefined;
      this.reblogCount = undefined;
      this.commentCount = post?.commentsCount ?? 0;
      this.syncing = false;
      return;
    }
    this.likeState = engagementState.getLikeState(post.id);
    this.reblogCount = engagementState.getReblogCount(post.id);
    this.commentCount = engagementState.getCommentCount(post.id) ?? post.commentsCount ?? 0;
  }

  private async ensureActorStateHydrated(): Promise<void> {
    const post = this.post;
    const actor = getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId ?? null;
    if (!post || !actor) {
      this.syncLocalStateFromCache();
      return;
    }
    if (this.likeState !== undefined && this.reblogCount !== undefined) {
      return;
    }
    const requestId = ++this.syncRequestId;
    this.syncing = true;
    try {
      await Promise.all([
        engagementState.hydrateLikeStates([post.id]),
        engagementState.hydrateReblogStates([post.id]),
      ]);
      if (requestId !== this.syncRequestId || this.post?.id !== post.id) {
        return;
      }
      this.syncLocalStateFromCache();
      if (this.likeState === undefined) {
        this.likeState = false;
      }
      if (this.reblogCount === undefined) {
        this.reblogCount = 0;
      }
    } finally {
      if (requestId === this.syncRequestId) {
        this.syncing = false;
      }
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

  private async toggleLike(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const post = this.post;
    if (!post || this.liking) return;

    await this.ensureActorStateHydrated();
    const nextLikeState = !(this.likeState ?? false);
    this.liking = true;
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
    } finally {
      this.liking = false;
    }
  }

  private async triggerReblog(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const post = this.post;
    if (!post || this.reblogSubmitting) return;

    if (FEATURE_FLAGS.reblog_composer !== true) {
      const previousReblogCount = this.reblogCount ?? 0;
      try {
        await this.ensureActorStateHydrated();
        this.reblogging = true;
        this.reblogCount = previousReblogCount + 1;
        await engagementState.reblogPost(post.id);
        this.reblogCount = engagementState.getReblogCount(post.id) ?? previousReblogCount + 1;
      } catch (error) {
        console.error('Failed to reblog post', error);
        this.reblogCount = engagementState.getReblogCount(post.id) ?? previousReblogCount;
      } finally {
        this.reblogging = false;
      }
      return;
    }

    this.commentModalOpen = false;
    this.commentBody = '';
    this.commentError = null;
    this.reblogComposerOpen = true;
    this.reblogError = null;
  }

  private closeReblogComposer(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.reblogSubmitting) {
      return;
    }
    this.resetReblogComposer();
  }

  private removeReblogTag(index: number): void {
    this.reblogTags = this.reblogTags.filter((_, tagIndex) => tagIndex !== index);
  }

  private handleReblogTagKeydown(event: KeyboardEvent): void {
    if (event.key === ',' || event.key === 'Enter') {
      event.preventDefault();
      this.flushReblogTagInput();
      return;
    }
    if (event.key === 'Backspace' && !this.reblogTagInput && this.reblogTags.length > 0) {
      event.preventDefault();
      this.reblogTags = this.reblogTags.slice(0, -1);
    }
  }

  private handleReblogTagInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.reblogError) {
      this.reblogError = null;
    }
    if (!value.includes(',')) {
      this.reblogTagInput = value;
      return;
    }

    const segments = value.split(',');
    const pending = segments.pop() ?? '';
    segments.forEach((segment) => this.commitReblogTag(segment));
    this.reblogTagInput = pending;
  }

  private async submitReblog(mode: 'live' | 'queue', event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const post = this.post;
    if (!post || this.reblogSubmitting) {
      return;
    }

    const comment = this.reblogNote.trim();
    const tags = this.flushReblogTagInput();

    this.reblogSubmitting = true;
    this.reblogError = null;

    if (mode === 'queue') {
      try {
        await engagementState.reblogPost({
          postId: post.id,
          comment: comment || undefined,
          tags: tags.length > 0 ? tags : undefined,
          mode: 'queue',
        });
        this.dispatchEvent(new CustomEvent('reblog-compose-submit', {
          detail: { postId: post.id, mode: 'queue', comment, tags },
          bubbles: true,
          composed: true,
        }));
        this.resetReblogComposer();
      } catch (error) {
        console.error('Failed to queue reblog', error);
        this.reblogError = error instanceof Error ? error.message : 'Failed to queue reblog';
        this.reblogSubmitting = false;
      }
      return;
    }

    const previousReblogCount = this.reblogCount ?? 0;

    try {
      await this.ensureActorStateHydrated();
      this.reblogging = true;
      this.reblogCount = previousReblogCount + 1;
      await engagementState.reblogPost({
        postId: post.id,
        comment: comment || undefined,
        tags: tags.length > 0 ? tags : undefined,
        mode: 'live',
      });
      this.reblogCount = engagementState.getReblogCount(post.id) ?? previousReblogCount + 1;
      this.dispatchEvent(new CustomEvent('reblog-compose-submit', {
        detail: { postId: post.id, mode: 'live', comment, tags },
        bubbles: true,
        composed: true,
      }));
      this.resetReblogComposer();
    } catch (error) {
      console.error('Failed to reblog post', error);
      this.reblogCount = engagementState.getReblogCount(post.id) ?? previousReblogCount;
      this.reblogError = error instanceof Error ? error.message : 'Failed to reblog post';
    } finally {
      this.reblogging = false;
      this.reblogSubmitting = false;
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

  private canDeletePost(): boolean {
    const post = this.post;
    const actorBlogId = getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId ?? null;
    return Boolean(this.variant === 'detail' && post?.blogId && actorBlogId && post.blogId === actorBlogId);
  }

  private async handleDelete(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const post = this.post;
    const actingBlogId = getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId ?? null;
    if (!post || !actingBlogId || this.deleting || !this.canDeletePost()) return;
    if (!window.confirm(`Delete post ${post.id}?`)) return;

    this.deleting = true;
    try {
      await deletePostRequest({ actingBlogId, postId: post.id });
      const fallback = post.blogName ? buildPageUrl('activity', post.blogName) : '/';
      window.location.assign(fallback);
    } catch (error) {
      console.error('Failed to delete post', error);
    } finally {
      this.deleting = false;
    }
  }

  private renderCounts() {
    const post = this.post;
    if (!post) return nothing;
    const presentation = toPresentationModel(post, {
      surface: this.variant === 'detail' ? 'detail' : 'card',
      page: this.variant === 'detail' ? 'post' : 'feed',
    });
    const reblogAction = presentation.actions.reblog;
    const commentAction = presentation.actions.comment;
    const likeAction = presentation.actions.like;
    const likeCount = likeAction.count ?? 0;
    const totalReblogCount = reblogAction.count ?? 0;
    const actorReblogCount = this.reblogCount ?? 0;
    const commentCount = this.commentCount ?? commentAction.count ?? 0;
    const shouldShowReblogCount = this.variant === 'detail' || totalReblogCount > 0;
    const shouldShowCommentCount = this.variant === 'detail' || commentCount > 0;
    const shouldShowLikeCount = this.variant === 'detail' || likeCount > 0;
    return html`
      <div class="actions-row">
        <div class="action-group">
          <button
            class="icon-btn ${actorReblogCount > 0 ? 'reblog-active' : ''}"
            type="button"
            aria-pressed=${actorReblogCount > 0 ? 'true' : 'false'}
            title=${actorReblogCount > 0 ? 'Reblogged' : reblogAction.label}
            ?disabled=${!Boolean(getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId) || this.syncing || this.reblogSubmitting || this.reblogging}
            @click=${this.triggerReblog}
          >
            ${this.reblogging ? '⟳' : reblogAction.icon}
          </button>
          ${shouldShowReblogCount
            ? html`<button class="count-chip count-chip-button ${totalReblogCount > 0 ? 'reblog-active' : ''}" type="button" @click=${(event: Event) => this.openEngagementTab('reblogs', event)}>
                ${totalReblogCount}
              </button>`
            : nothing}
        </div>
        <div class="action-group">
          <button
            class="icon-btn ${commentCount > 0 ? 'comment-active' : ''}"
            type="button"
            title=${commentAction.label}
            ?disabled=${!Boolean(getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId) || this.syncing}
            @click=${this.openCommentModal}
          >
            ${commentAction.icon}
          </button>
          ${shouldShowCommentCount
            ? html`<button class="count-chip count-chip-button ${commentCount > 0 ? 'comment-active' : ''}" type="button" @click=${(event: Event) => this.openEngagementTab('comments', event)}>
                ${commentCount}
              </button>`
            : nothing}
        </div>
        <div class="action-group">
          <button
            class="icon-btn ${this.likeState ? 'like-active' : ''}"
            type="button"
            aria-pressed=${this.likeState ? 'true' : 'false'}
            title=${this.likeState ? 'Liked' : likeAction.label}
            ?disabled=${!Boolean(getAuthUser()?.activeBlogId ?? getAuthUser()?.blogId) || this.syncing || this.liking}
            @click=${this.toggleLike}
          >
            ${likeAction.icon}
          </button>
          ${shouldShowLikeCount
            ? html`<button class="count-chip count-chip-button ${likeCount > 0 ? 'like-active' : ''}" type="button" @click=${(event: Event) => this.openEngagementTab('likes', event)}>
                ${likeCount}
              </button>`
            : nothing}
        </div>
        ${this.canDeletePost()
          ? html`<button class="danger-btn" type="button" ?disabled=${this.deleting} @click=${this.handleDelete}>${this.deleting ? 'Deleting…' : 'Delete'}</button>`
          : nothing}
      </div>
    `;
  }

  private renderReblogModal() {
    if (!this.reblogComposerOpen || !this.post) {
      return nothing;
    }

    return html`
      <div class="modal-backdrop" @click=${this.closeReblogComposer}>
        <section class="modal" role="dialog" aria-modal="true" aria-label="Reblog composer" @click=${(event: Event) => event.stopPropagation()}>
          <h3>Reblog post</h3>
          <p>Add a note if you want. Tags are optional.</p>
          <textarea
            class="composer reblog-note"
            placeholder="Add a note (optional)..."
            .value=${this.reblogNote}
            ?disabled=${this.reblogSubmitting}
            @input=${(event: Event) => {
              this.reblogNote = (event.target as HTMLTextAreaElement).value;
              if (this.reblogError) {
                this.reblogError = null;
              }
            }}
          ></textarea>
          <div class="tags-field">
            <div class="tags-label">Tags (optional)</div>
            <div class="tags-shell">
              ${this.reblogTags.map((tag, index) => html`
                <span class="tag-chip">
                  #${tag}
                  <button
                    class="tag-chip-remove"
                    type="button"
                    aria-label=${`Remove tag ${tag}`}
                    ?disabled=${this.reblogSubmitting}
                    @click=${() => this.removeReblogTag(index)}
                  >×</button>
                </span>
              `)}
              <input
                class="tag-input"
                type="text"
                placeholder="Type a tag, then comma"
                .value=${this.reblogTagInput}
                ?disabled=${this.reblogSubmitting}
                @input=${this.handleReblogTagInput}
                @keydown=${this.handleReblogTagKeydown}
                @blur=${() => this.flushReblogTagInput()}
              />
            </div>
          </div>
          <div class="modal-note">Queue is UI-only in this build while backend queue wiring is pending.</div>
          ${this.reblogError ? html`<div class="modal-error">${this.reblogError}</div>` : ''}
          <div class="modal-actions">
            <button type="button" class="comment-btn" ?disabled=${this.reblogSubmitting} @click=${this.closeReblogComposer}>Cancel</button>
            <button type="button" class="comment-btn" data-mode="queue" ?disabled=${this.reblogSubmitting} @click=${(event: Event) => this.submitReblog('queue', event)}>
              ${this.reblogSubmitting ? 'Saving…' : 'Queue'}
            </button>
            <button type="button" class="comment-btn" data-mode="live" ?disabled=${this.reblogSubmitting} @click=${(event: Event) => this.submitReblog('live', event)}>
              ${this.reblogSubmitting ? 'Reblogging…' : 'Reblog'}
            </button>
          </div>
        </section>
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
      ${this.renderReblogModal()}
      ${this.renderCommentModal()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-actions': PostActions;
  }
}
