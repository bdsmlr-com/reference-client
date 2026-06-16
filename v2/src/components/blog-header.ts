import { LitElement, html, css, unsafeCSS, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { buildPageUrl } from '../services/blog-resolver.js';
import { handleAvatarImageError, normalizeAvatarUrl } from '../services/avatar-url.js';
import { BREAKPOINTS, SPACING } from '../types/ui-constants.js';
import type { IdentityDecoration } from '../types/api.js';
import { getAuthUser } from '../state/auth-state.js';
import { followStateController } from '../services/follow-state.js';
import { blockedStateController } from '../services/blocked-state.js';
import { reportBlog } from '../services/api.js';
import './route-shell-card.js';
import './blog-identity.js';

type PageName = 'archive' | 'timeline' | 'social' | 'following' | 'activity' | 'feed' | 'follower-feed';

function truncateWithEllipsis(value: string, limit: number, suffix = '...'): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, limit)).trimEnd()}${suffix}`;
}

@customElement('blog-header')
export class BlogHeader extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        margin-bottom: ${SPACING.LG}px;
      }

      .header-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: ${SPACING.SM}px ${SPACING.LG}px;
      }

      .summary-card {
        width: min(100%, 900px);
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 14px;
        align-items: center;
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        text-align: left;
      }

      .summary-card-main {
        min-width: 0;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 14px;
        align-items: start;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        text-align: left;
      }

      .summary-card-main:hover {
        opacity: 0.96;
      }

      .summary-actions {
        position: relative;
        justify-self: end;
        align-self: center;
      }

      .menu-trigger {
        min-width: 40px;
        min-height: 40px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg);
        color: var(--text-primary);
        font: inherit;
        font-size: 18px;
        font-weight: 700;
        cursor: pointer;
      }

      .menu-trigger:disabled {
        opacity: 0.66;
        cursor: default;
      }

      .menu-backdrop,
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

      .menu-backdrop {
        background: transparent;
        padding: 0;
      }

      .menu-popover {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 2100;
        width: min(260px, calc(100vw - 32px));
        display: grid;
        gap: 6px;
        padding: 10px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.22);
      }

      .menu-item {
        width: 100%;
        min-height: 38px;
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
      }

      .menu-item:hover {
        border-color: var(--accent);
      }

      .menu-item.danger {
        color: #f58f8f;
      }

      .menu-item:disabled {
        opacity: 0.66;
        cursor: default;
      }

      .summary-avatar,
      .summary-avatar-fallback {
        width: 56px;
        height: 56px;
        border-radius: 999px;
        overflow: hidden;
        flex: 0 0 auto;
      }

      .summary-avatar {
        display: block;
        object-fit: cover;
      }

      .summary-avatar-fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 20px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .summary-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .summary-name {
        color: var(--text-primary);
      }

      .summary-title,
      .summary-description {
        color: var(--text-muted);
        min-width: 0;
      }

      .summary-title {
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .summary-description {
        font-size: 13px;
        line-height: 1.4;
      }

      .subnav {
        display: flex;
        justify-content: center;
        gap: 6px;
        flex-wrap: wrap;
        margin: 0;
      }

      .subnav-link {
        padding: 6px 10px;
        border-radius: 4px;
        background: transparent;
        color: var(--text-muted);
        font-size: 13px;
        text-decoration: none;
        transition: all 0.2s;
      }

      .subnav-link:hover {
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        text-decoration: none;
      }

      .subnav-link.active {
        background: var(--accent);
        color: #fff;
      }

      .modal {
        width: min(520px, 100%);
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        text-align: center;
      }

      .modal-avatar,
      .modal-avatar-fallback {
        width: min(320px, 68vw);
        height: min(320px, 68vw);
        border-radius: 999px;
        overflow: hidden;
        margin: 0 auto;
      }

      .modal-avatar {
        display: block;
        object-fit: cover;
      }

      .modal-avatar-fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 96px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .modal-title {
        margin: 0;
        color: var(--text-primary);
      }

      .modal-subtitle,
      .modal-description,
      .modal-copy,
      .modal-error {
        color: var(--text-muted);
        text-align: left;
      }

      .modal-copy {
        margin: 0;
      }

      .modal-error {
        color: var(--error, #ff8f8f);
        font-size: 13px;
      }

      .modal-close,
      .modal-submit {
        align-self: center;
        min-height: 36px;
        padding: 0 14px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font: inherit;
        cursor: pointer;
      }

      .modal-submit {
        background: var(--text-primary);
        color: var(--bg);
        border-color: var(--text-primary);
      }

      .modal-submit:disabled,
      .modal-close:disabled {
        opacity: 0.66;
        cursor: default;
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .report-composer {
        width: 100%;
        min-height: 120px;
        resize: vertical;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--bg);
        color: var(--text-primary);
        font: inherit;
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .header-container {
          padding: ${SPACING.SM}px;
        }

        .summary-card {
          grid-template-columns: 1fr;
          justify-items: center;
          text-align: center;
        }

        .summary-card-main {
          width: 100%;
          grid-template-columns: 1fr;
          justify-items: center;
          text-align: center;
        }

        .summary-copy {
          width: 100%;
          align-items: center;
        }

        .summary-actions {
          justify-self: center;
        }

        .menu-popover {
          right: 50%;
          transform: translateX(50%);
        }
      }
    `,
  ];

  @property({ type: String }) page: PageName = 'timeline';
  @property({ type: Number }) blogId = 0;
  @property({ type: String }) blogName = '';
  @property({ type: String }) blogTitle = '';
  @property({ type: String }) blogDescription = '';
  @property({ type: String }) avatarUrl = '';
  @property({ attribute: false }) identityDecorations: IdentityDecoration[] = [];

  @state() private modalOpen = false;
  @state() private menuOpen = false;
  @state() private reportModalOpen = false;
  @state() private followState: boolean | undefined = undefined;
  @state() private followLoading = false;
  @state() private followPending = false;
  @state() private blockedState: boolean | undefined = undefined;
  @state() private blockedLoading = false;
  @state() private blockPending = false;
  @state() private reportPending = false;
  @state() private reportBody = '';
  @state() private reportError: string | null = null;
  @state() private reportSubmitted = false;

  private unsubscribeFollowState?: () => void;
  private unsubscribeBlockedState?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribeFollowState = followStateController.subscribe(() => {
      this.syncFollowStateFromCache();
    });
    this.unsubscribeBlockedState = blockedStateController.subscribe(() => {
      this.syncBlockedStateFromCache();
    });
  }

  disconnectedCallback(): void {
    this.unsubscribeFollowState?.();
    this.unsubscribeFollowState = undefined;
    this.unsubscribeBlockedState?.();
    this.unsubscribeBlockedState = undefined;
    super.disconnectedCallback();
  }

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has('blogId') || changed.has('blogName')) {
      this.reportSubmitted = false;
      this.reportBody = '';
      this.reportError = null;
      this.menuOpen = false;
      this.syncFollowStateFromCache();
      this.syncBlockedStateFromCache();
      void this.hydrateFollowState();
      void this.hydrateBlockedState();
    }
  }

  private getSubnavUrl(page: string, blogName: string): string {
    if (page === 'feed') return `/feed/for/${blogName}`;
    if (page === 'follower-feed') return `/follower-feed/${blogName}`;
    if (page === 'activity') return buildPageUrl('activity', blogName);
    if (page === 'archive') return `/archive/${blogName}`;
    if (page === 'social') return buildPageUrl('social', blogName);
    return buildPageUrl(page, blogName);
  }

  private get summaryTitle(): string {
    return truncateWithEllipsis(this.blogTitle, 72);
  }

  private get summaryDescription(): string {
    const trimmed = this.blogDescription.trim();
    if (!trimmed) return '';
    if (trimmed.length <= 88) return trimmed;
    return `${trimmed.slice(0, 88).trimEnd()} [more...]`;
  }

  private get avatarSrc(): string | null {
    return normalizeAvatarUrl(this.avatarUrl);
  }

  private get avatarInitial(): string {
    return (this.blogName.trim().replace(/^@+/, '').charAt(0) || '?').toUpperCase();
  }

  private get currentActorBlogId(): number | null {
    const user = getAuthUser();
    return user?.activeBlogId ?? user?.blogId ?? null;
  }

  private get canRenderActionMenu(): boolean {
    const actorBlogId = this.currentActorBlogId;
    return this.page === 'activity' && Boolean(actorBlogId && this.blogId > 0 && actorBlogId !== this.blogId);
  }

  private syncFollowStateFromCache(): void {
    if (!this.canRenderActionMenu) {
      this.followState = undefined;
      return;
    }
    this.followState = followStateController.getFollowState(this.blogId);
  }

  private syncBlockedStateFromCache(): void {
    if (!this.canRenderActionMenu) {
      this.blockedState = undefined;
      return;
    }
    this.blockedState = blockedStateController.getBlockedState(this.blogId);
  }

  private async hydrateFollowState(): Promise<void> {
    if (!this.canRenderActionMenu) {
      this.followLoading = false;
      return;
    }
    this.followLoading = this.followState === undefined;
    try {
      const value = await followStateController.hydrateFollowState(this.blogId);
      this.followState = value;
    } catch (error) {
      console.error('Failed to hydrate follow state', error);
    } finally {
      this.followLoading = false;
    }
  }

  private async hydrateBlockedState(): Promise<void> {
    if (!this.canRenderActionMenu) {
      this.blockedLoading = false;
      return;
    }
    this.blockedLoading = this.blockedState === undefined;
    try {
      const value = await blockedStateController.hydrateBlockedState(this.blogId);
      this.blockedState = value;
    } catch (error) {
      console.error('Failed to hydrate blocked state', error);
    } finally {
      this.blockedLoading = false;
    }
  }

  private closeMenu = (): void => {
    this.menuOpen = false;
  };

  private toggleMenu = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  };

  private handleFollowClick = async (event: Event): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canRenderActionMenu || this.followPending) return;

    const targetLabel = `@${this.blogName.replace(/^@+/, '')}`;
    this.followPending = true;
    try {
      if (this.followState) {
        if (!window.confirm(`Unfollow ${targetLabel}?`)) {
          return;
        }
        await followStateController.unfollowBlog(this.blogId);
        this.followState = false;
      } else {
        await followStateController.followBlog(this.blogId);
        this.followState = true;
      }
      this.closeMenu();
    } catch (error) {
      console.error('Failed to update follow state', error);
    } finally {
      this.followPending = false;
    }
  };

  private handleBlockClick = async (event: Event): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canRenderActionMenu || this.blockPending) return;

    const targetLabel = `@${this.blogName.replace(/^@+/, '')}`;
    this.blockPending = true;
    try {
      if (this.blockedState) {
        if (!window.confirm(`Unblock ${targetLabel}?`)) {
          return;
        }
        await blockedStateController.unblockBlog(this.blogId);
        this.blockedState = false;
      } else {
        if (!window.confirm(`Block ${targetLabel} and the owner's other blogs?`)) {
          return;
        }
        await blockedStateController.blockBlog(this.blogId);
        this.blockedState = true;
      }
      this.closeMenu();
    } catch (error) {
      console.error('Failed to update blocked state', error);
    } finally {
      this.blockPending = false;
    }
  };

  private openReportModal = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    this.reportError = null;
    this.reportBody = '';
    this.reportModalOpen = true;
    this.closeMenu();
  };

  private closeReportModal = (event?: Event): void => {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.reportPending) return;
    this.reportModalOpen = false;
    this.reportError = null;
    this.reportBody = '';
  };

  private submitReport = async (event: Event): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();
    const actingBlogId = this.currentActorBlogId;
    if (!actingBlogId || !this.blogId || this.reportPending) return;
    const reason = this.reportBody.trim();
    if (!reason) {
      this.reportError = 'Enter a short reason before submitting.';
      return;
    }
    this.reportPending = true;
    this.reportError = null;
    try {
      await reportBlog({ actingBlogId, targetBlogId: this.blogId, reason });
      this.reportSubmitted = true;
      this.reportModalOpen = false;
      this.reportBody = '';
    } catch (error) {
      console.error('Failed to report blog', error);
      this.reportError = error instanceof Error ? error.message : 'Failed to submit report';
    } finally {
      this.reportPending = false;
    }
  };

  private openModal = (): void => {
    this.modalOpen = true;
  };

  private closeModal = (): void => {
    this.modalOpen = false;
  };

  private renderActionMenu() {
    if (!this.canRenderActionMenu) {
      return nothing;
    }

    const followLabel = this.followLoading && this.followState === undefined
      ? 'Follow…'
      : (this.followState ? 'Unfollow' : 'Follow');
    const blockLabel = this.blockedLoading && this.blockedState === undefined
      ? 'Block…'
      : (this.blockedState ? 'Unblock' : 'Block');

    return html`
      <div class="summary-actions">
        <button
          class="menu-trigger"
          type="button"
          aria-haspopup="menu"
          aria-expanded=${String(this.menuOpen)}
          aria-label=${`More actions for @${this.blogName}`}
          @click=${this.toggleMenu}
        >⋯</button>
        ${this.menuOpen ? html`
          <div class="menu-backdrop" @click=${this.closeMenu}></div>
          <div class="menu-popover" role="menu" @click=${(event: Event) => event.stopPropagation()}>
            <button class="menu-item" type="button" role="menuitem" ?disabled=${this.followPending || this.followLoading} @click=${this.handleFollowClick}>${followLabel}</button>
            <button class="menu-item danger" type="button" role="menuitem" ?disabled=${this.blockPending || this.blockedLoading} @click=${this.handleBlockClick}>${blockLabel}</button>
            <button class="menu-item" type="button" role="menuitem" ?disabled=${this.reportSubmitted} @click=${this.openReportModal}>${this.reportSubmitted ? 'Reported' : 'Report blog'}</button>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private renderReportModal() {
    if (!this.reportModalOpen) {
      return nothing;
    }

    const trimmed = this.reportBody.trim();
    return html`
      <div class="modal-backdrop" @click=${this.closeReportModal}>
        <section class="modal" role="dialog" aria-modal="true" aria-label="Report blog" @click=${(event: Event) => event.stopPropagation()}>
          <h3 class="modal-title">Report @${this.blogName.replace(/^@+/, '')}</h3>
          <p class="modal-copy">Send a one-off report to the legacy moderation flow.</p>
          <textarea
            class="report-composer"
            placeholder="Reason for reporting..."
            .value=${this.reportBody}
            ?disabled=${this.reportPending}
            @input=${(event: Event) => {
              this.reportBody = (event.target as HTMLTextAreaElement).value;
              if (this.reportError) this.reportError = null;
            }}
          ></textarea>
          ${this.reportError ? html`<div class="modal-error">${this.reportError}</div>` : nothing}
          <div class="modal-actions">
            <button class="modal-close" type="button" ?disabled=${this.reportPending} @click=${this.closeReportModal}>Cancel</button>
            <button class="modal-submit" type="button" ?disabled=${this.reportPending || !trimmed} @click=${this.submitReport}>${this.reportPending ? 'Reporting…' : 'Report blog'}</button>
          </div>
        </section>
      </div>
    `;
  }

  render() {
    if (!this.blogName) {
      return null;
    }

    const activePage =
      this.page === 'timeline'
        ? 'activity'
        : (this.page === 'following' ? 'feed' : this.page);
    const navPages = [
      { name: 'feed', label: 'Feed' },
      { name: 'follower-feed', label: "Followers' Feed" },
      { name: 'activity', label: 'Activity' },
      { name: 'archive', label: 'Archive' },
      { name: 'social', label: 'Connections' },
    ];

    return html`
      <div role="region" aria-label="Blog header">
        <div class="header-container">
          <div class="summary-card">
            <button class="summary-card-main" type="button" @click=${this.openModal} aria-label=${`View details for @${this.blogName}`}>
              ${this.avatarSrc
                ? html`<img class="summary-avatar" src=${this.avatarSrc} alt=${`Avatar for @${this.blogName}`} @error=${handleAvatarImageError} />`
                : html`<div class="summary-avatar-fallback" aria-hidden="true">${this.avatarInitial}</div>`}
              <div class="summary-copy">
                <div class="summary-name">
                  <blog-identity
                    variant="micro"
                    .blogName=${this.blogName}
                    .identityDecorations=${this.identityDecorations}
                    .showAvatar=${false}
                  ></blog-identity>
                </div>
                ${this.summaryTitle ? html`<div class="summary-title">${this.summaryTitle}</div>` : nothing}
                ${this.summaryDescription ? html`<div class="summary-description">${this.summaryDescription}</div>` : nothing}
              </div>
            </button>
            ${this.renderActionMenu()}
          </div>
        </div>
        <route-shell-card compact>
          <nav class="subnav" aria-label="Blog navigation">
            ${navPages.map((page) => {
              const href = this.getSubnavUrl(page.name, this.blogName);
              return html`
                <a class="subnav-link ${activePage === page.name ? 'active' : ''}" href=${href}>
                  ${page.label}
                </a>
              `;
            })}
          </nav>
        </route-shell-card>
      </div>

      ${this.modalOpen ? html`
        <div class="modal-backdrop" @click=${this.closeModal}>
          <section class="modal" role="dialog" aria-modal="true" aria-label="Blog details" @click=${(event: Event) => event.stopPropagation()}>
            ${this.avatarSrc
              ? html`<img class="modal-avatar" src=${this.avatarSrc} alt=${`Avatar for @${this.blogName}`} @error=${handleAvatarImageError} />`
              : html`<div class="modal-avatar-fallback" aria-hidden="true">${this.avatarInitial}</div>`}
            <h3 class="modal-title">@${this.blogName.replace(/^@+/, '')}</h3>
            ${this.blogTitle ? html`<div class="modal-subtitle">${this.blogTitle}</div>` : nothing}
            ${this.blogDescription ? html`<div class="modal-description">${this.blogDescription}</div>` : nothing}
            <button class="modal-close" type="button" @click=${this.closeModal}>Close</button>
          </section>
        </div>
      ` : nothing}

      ${this.renderReportModal()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blog-header': BlogHeader;
  }
}
