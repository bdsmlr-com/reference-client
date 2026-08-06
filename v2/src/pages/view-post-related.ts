import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import type { Post } from '../types/api.js';
import { getAuthUser } from '../state/auth-state.js';
import {
  buildRelatedPerspectiveTabs,
  relatedPerspectiveHref,
  relatedPerspectiveLabel,
  resolveActiveRelatedPerspective,
  selectDefaultRelatedPerspective,
  type RelatedPerspective,
  type RelatedPerspectiveSet,
} from '../services/related-perspective.js';
import '../components/post-recommendations.js';

@customElement('view-post-related')
export class ViewPostRelated extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: 32px 20px 56px;
        max-width: 1200px;
        margin: 0 auto;
        min-height: 100vh;
      }

      .back-nav {
        margin-bottom: 20px;
      }

      .back-link {
        color: var(--text-muted);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
      }

      .back-link:hover {
        color: var(--accent);
      }

      .subtitle {
        color: var(--text-muted);
        font-size: 14px;
        margin: 0 0 16px;
      }

      .perspective-nav {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin: 0;
      }

      .perspective-tab {
        padding: 6px 14px;
        min-height: 30px;
        border: 1px solid var(--border);
        border-radius: 4px;
        background: var(--bg-panel);
        color: var(--text-muted);
        text-decoration: none;
        font-size: 13px;
      }

      .perspective-tab:hover {
        background: var(--bg-panel-alt);
      }

      .perspective-tab.active {
        background: var(--accent);
        border-color: var(--accent);
        color: white;
      }

      .perspective-tab:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .perspective-pane {
        margin-top: 6px;
        padding: 16px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
      }

      post-recommendations {
        margin-top: 0;
      }
    `,
  ];

  @property({ type: String }) postId = '';
  @property({ type: String }) routePerspective = 'you';
  @property({ type: String }) title = 'Related posts';
  @state() private seedPost: Post | null = null;
  @state() private seedLoadToken = 0;
  @state() private authVersion = 0;

  private readonly handleAuthUserChanged = () => {
    this.authVersion += 1;
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('auth-user-changed', this.handleAuthUserChanged as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('auth-user-changed', this.handleAuthUserChanged as EventListener);
  }

  private get normalizedPostId(): number {
    return parseInt(this.postId, 10) || 0;
  }

  private get hasDistinctOriginPost(): boolean {
    const originPostId = this.seedPost?.originPostId;
    return typeof originPostId === 'number'
      && originPostId > 0
      && originPostId !== this.normalizedPostId;
  }

  private get hasSameOriginAndDisplayedBlog(): boolean {
    if (!this.seedPost) return false;

    const { originBlogId, blogId, originBlogName, blogName } = this.seedPost;
    if (typeof originBlogId === 'number' && originBlogId > 0 && typeof blogId === 'number' && blogId > 0) {
      return originBlogId === blogId;
    }

    return Boolean(originBlogName && blogName && originBlogName.trim().toLowerCase() === blogName.trim().toLowerCase());
  }

  private get isReblog(): boolean {
    return this.hasDistinctOriginPost && !this.hasSameOriginAndDisplayedBlog;
  }

  private get relatedSeedPostId(): number {
    const originPostId = this.seedPost?.originPostId;
    return this.hasDistinctOriginPost && originPostId !== undefined
      ? originPostId
      : this.normalizedPostId;
  }

  private get currentPerspective(): string {
    const raw = (this.routePerspective || 'you').trim().toLowerCase();
    return raw || 'you';
  }

  protected willUpdate(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('postId')) {
      this.seedLoadToken += 1;
      this.seedPost = null;
      void this.loadSeedPost(this.normalizedPostId, this.seedLoadToken);
    }
  }

  private async loadSeedPost(id: number, loadToken: number): Promise<void> {
    if (!id) {
      this.seedPost = null;
      return;
    }

    try {
      const resp = await apiClient.posts.get(id);
      if (loadToken !== this.seedLoadToken || id !== this.normalizedPostId) {
        return;
      }
      this.seedPost = resp.post || null;
    } catch {
      if (loadToken !== this.seedLoadToken || id !== this.normalizedPostId) {
        return;
      }
      this.seedPost = null;
    }
  }

  private get perspectiveSet(): RelatedPerspectiveSet | undefined {
    if (!this.seedPost) return undefined;

    const original: RelatedPerspective = {
      role: 'original',
      blogId: this.seedPost.originBlogId ?? this.seedPost.blogId,
      blogName: this.seedPost.originBlogName || this.seedPost.blogName || '',
    };
    const reblogger = this.isReblog
      ? {
          role: 'reblogger' as const,
          blogId: this.seedPost.blogId,
          blogName: this.seedPost.blogName || '',
        }
      : undefined;

    return {
      authenticated: Boolean(getAuthUser()),
      viewer: resolveActiveRelatedPerspective(getAuthUser()),
      original,
      reblogger,
      isReblog: this.isReblog,
    };
  }

  private get perspectiveTabs(): RelatedPerspective[] {
    const set = this.perspectiveSet;
    if (!set) return [];

    const tabs = buildRelatedPerspectiveTabs(set);
    const selected = this.selectedPerspective;
    if (!selected || tabs.some((tab) => tab.role === selected.role)) {
      return tabs;
    }

    const duplicateIndex = tabs.findIndex((tab) =>
      tab.blogId === selected.blogId
      && tab.blogName.toLowerCase() === selected.blogName.toLowerCase(),
    );
    if (duplicateIndex < 0) return tabs;

    return tabs.map((tab, index) => index === duplicateIndex ? selected : tab);
  }

  private get selectedPerspective(): RelatedPerspective | undefined {
    const set = this.perspectiveSet;
    if (!set) return undefined;
    if (this.currentPerspective === 'you') {
      return selectDefaultRelatedPerspective(set);
    }

    const routeName = this.currentPerspective.replace(/^@+/, '');
    const candidates = [set.original, set.reblogger];
    const matches = candidates.filter((perspective): perspective is RelatedPerspective =>
      perspective !== undefined
      && Boolean(perspective.blogName)
      && perspective.blogName.toLowerCase() === routeName,
    );

    return matches.length === 1 ? matches[0] : undefined;
  }

  private get originalBlogName(): string {
    return this.perspectiveSet?.original.blogName || 'the original blog';
  }

  private isActiveTab(perspective: RelatedPerspective): boolean {
    const selected = this.selectedPerspective;
    return Boolean(selected
      && selected.role === perspective.role
      && selected.blogId === perspective.blogId
      && selected.blogName.toLowerCase() === perspective.blogName.toLowerCase());
  }

  private handleTabKeydown(event: KeyboardEvent): void {
    const tab = event.currentTarget as HTMLAnchorElement;
    const tabs = Array.from(this.shadowRoot?.querySelectorAll<HTMLAnchorElement>('[role="tab"]') || []);
    const index = tabs.indexOf(tab);
    if (index < 0) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      tabs[(index + direction + tabs.length) % tabs.length]?.focus();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      tab.click();
    }
  }

  render() {
    const id = this.normalizedPostId;
    if (!id) {
      return html`<div class="subtitle">Missing post id.</div>`;
    }
    const tabs = this.perspectiveTabs;
    const activeTabIndex = tabs.findIndex((perspective) => this.isActiveTab(perspective));
    const displayedReblogPostId = this.isReblog && this.selectedPerspective?.role === 'reblogger' ? id : 0;

    return html`
      <div class="back-nav">
        <a href="/post/${id}" class="back-link">← Back to post</a>
      </div>

      <div class="subtitle">Perspectives for similar posts from @${this.originalBlogName}</div>

      <nav class="perspective-nav" role="tablist" aria-label="Related perspectives">
        ${tabs.map((perspective, index) => {
          const active = this.isActiveTab(perspective);
          const keyboardFocusable = active || (activeTabIndex < 0 && index === 0);
          return html`
            <a
              id="related-perspective-tab-${perspective.role}"
              class="perspective-tab ${active ? 'active' : ''}"
              role="tab"
              href=${relatedPerspectiveHref(id, perspective)}
              aria-selected=${active ? 'true' : 'false'}
              aria-controls="related-perspective-panel"
              tabindex=${keyboardFocusable ? '0' : '-1'}
              @keydown=${this.handleTabKeydown}
            >${relatedPerspectiveLabel(perspective)}</a>
          `;
        })}
      </nav>

      <section
        id="related-perspective-panel"
        class="perspective-pane"
        role="tabpanel"
        aria-labelledby=${this.selectedPerspective ? `related-perspective-tab-${this.selectedPerspective.role}` : nothing}
      >
        <post-recommendations
          .postId=${this.relatedSeedPostId}
          .displayedReblogPostId=${displayedReblogPostId}
          .mode=${'grid'}
          .perspective=${this.selectedPerspective}
          .title=${this.title}
        ></post-recommendations>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-post-related': ViewPostRelated;
  }
}
