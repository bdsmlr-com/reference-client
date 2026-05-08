import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { getStatus, getUserSettings, type SettingsBlog, type SettingsUser } from '../services/auth-service.js';
import { buildPageUrl } from '../services/blog-resolver.js';
import { handleAvatarImageError, normalizeAvatarUrl } from '../services/avatar-url.js';
import { ALL_POST_TYPES } from '../services/post-filter-url.js';
import {
  getInfiniteScrollPreference,
  getTypePreference,
  getVariantPreference,
  setInfiniteScrollPreference,
  setTypePreference,
  setVariantPreference,
  type VariantSelection,
} from '../services/storage.js';
import {
  DEFAULT_ACTIVITY_KINDS,
  getArchiveSortPreference,
  getBlogActivityKindsPreference,
  getFollowerFeedActivityKindsPreference,
  getFollowingActivityKindsPreference,
  getGalleryMode,
  getSearchSortPreference,
  normalizeActivityKinds,
  setArchiveSortPreference,
  setBlogActivityKindsPreference,
  setFollowerFeedActivityKindsPreference,
  setFollowingActivityKindsPreference,
  setGalleryMode,
  setSearchSortPreference,
  type ActivityKind,
  type GalleryMode,
} from '../services/profile.js';
import { normalizeSortValue } from '../types/post.js';
import type { PostType, PostVariant } from '../types/api.js';
import '../components/blog-identity.js';
import '../components/control-panel.js';

type PreferenceRoute = 'archive' | 'search' | 'feed' | 'followers-feed' | 'activity' | 'social';

type RoutePreferenceState = {
  sortValue?: string;
  selectedTypes?: PostType[];
  selectedVariants?: PostVariant[];
  activityKinds?: ActivityKind[];
  galleryMode?: GalleryMode;
  infiniteScroll: boolean;
};

const SORT_RESET = 'newest';

function selectionFromVariant(variant: VariantSelection): PostVariant[] {
  if (variant === 'original') return [1];
  if (variant === 'reblog') return [2];
  return [];
}

@customElement('view-settings-user')
export class ViewSettingsUser extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--bg-primary);
      }

      .wrap {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 16px 48px;
      }

      .section {
        margin-top: 24px;
      }

      .eyebrow {
        color: var(--text-muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      h1,
      h2 {
        margin: 8px 0 12px;
        color: var(--text-primary);
      }

      .status {
        color: var(--text-muted);
        padding: 32px 0;
      }

      .error {
        color: var(--accent);
        padding: 24px 0;
      }

      .cards {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .card {
        display: block;
        width: 100%;
        padding: 16px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--bg-panel);
        color: inherit;
        text-decoration: none;
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        appearance: none;
        font: inherit;
      }

      .card:hover {
        border-color: var(--accent);
      }

      .card:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .card-summary {
        min-width: 0;
        overflow: hidden;
      }

      .meta {
        display: flex;
        gap: 12px;
        margin-top: 10px;
        color: var(--text-muted);
        font-size: 12px;
        flex-wrap: wrap;
      }

      .cta {
        margin-top: 10px;
        color: var(--accent);
        font-size: 13px;
      }

      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        padding: 20px;
      }

      .modal {
        width: min(560px, 100%);
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
      }

      .modal-top {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        text-align: center;
      }

      .modal-avatar,
      .modal-avatar-fallback {
        width: 112px;
        height: 112px;
        border-radius: 999px;
        object-fit: cover;
        display: block;
      }

      .modal-avatar-fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--accent);
        color: #fff;
        font-size: 42px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .modal-title {
        margin: 0;
        color: var(--text-primary);
        font-size: 20px;
      }

      .modal-subtitle,
      .modal-description {
        color: var(--text-muted);
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .modal-description {
        white-space: pre-wrap;
      }

      .modal-meta {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        color: var(--text-muted);
        font-size: 12px;
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }

      .modal-button {
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        text-decoration: none;
        font-size: 13px;
      }

      .modal-button.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .pref-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 0;
        border-top: 1px solid var(--border);
      }

      .pref-row:first-of-type {
        border-top: none;
      }

      .pref-copy {
        width: 136px;
        flex: 0 0 136px;
      }

      .pref-label {
        color: var(--text-primary);
        font-size: 14px;
        font-weight: 600;
      }

      .pref-help {
        color: var(--text-muted);
        font-size: 12px;
        margin-top: 4px;
      }

      .pref-controls {
        flex: 1;
        min-width: 0;
      }

      .pref-reset {
        flex: 0 0 auto;
        min-height: 36px;
        padding: 0 14px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
        background: color-mix(in srgb, var(--accent) 10%, var(--bg-panel-alt));
        color: color-mix(in srgb, var(--accent) 70%, var(--text-primary));
        font-size: 12px;
      }

      .pref-reset:hover {
        background: color-mix(in srgb, var(--accent) 16%, var(--bg-panel-alt));
      }
    `,
  ];

  @state() private loading = true;
  @state() private error = '';
  @state() private user: SettingsUser | null = null;
  @state() private blogs: SettingsBlog[] = [];
  @state() private selectedBlog: SettingsBlog | null = null;
  @state() private routePrefs: Record<PreferenceRoute, RoutePreferenceState> = this.readRoutePreferences();

  connectedCallback(): void {
    super.connectedCallback();
    this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const status = await getStatus();
      const username = status.username || status.blog_name;
      if (!username) throw new Error('settings user request failed: missing username');
      const response = await getUserSettings(username);
      const fallbackBlogs = (status.blogs || []).map((blog) => ({
        id: blog.id,
        name: blog.name,
      }));
      if (
        fallbackBlogs.length === 0 &&
        typeof status.blog_id === 'number' &&
        status.blog_name
      ) {
        fallbackBlogs.push({
          id: status.blog_id,
          name: status.blog_name,
        });
      }
      const resolvedBlogs = response.blogs && response.blogs.length > 0 ? response.blogs : fallbackBlogs;
      this.user = response.user;
      this.blogs = resolvedBlogs;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'settings user request failed';
    } finally {
      this.loading = false;
    }
  }

  private openBlog(blog: SettingsBlog): void {
    this.selectedBlog = blog;
  }

  private closeBlog(): void {
    this.selectedBlog = null;
  }

  private readRoutePreferences(): Record<PreferenceRoute, RoutePreferenceState> {
    return {
      archive: {
        sortValue: normalizeSortValue(getArchiveSortPreference() || SORT_RESET),
        selectedTypes: getTypePreference('archive') as PostType[],
        selectedVariants: selectionFromVariant(getVariantPreference('archive')),
        galleryMode: getGalleryMode('archive'),
        infiniteScroll: getInfiniteScrollPreference('archive'),
      },
      search: {
        sortValue: normalizeSortValue(getSearchSortPreference() || SORT_RESET),
        selectedTypes: getTypePreference('search') as PostType[],
        selectedVariants: selectionFromVariant(getVariantPreference('search')),
        galleryMode: getGalleryMode('search'),
        infiniteScroll: getInfiniteScrollPreference('search'),
      },
      feed: {
        selectedTypes: getTypePreference('following') as PostType[],
        activityKinds: getFollowingActivityKindsPreference(),
        infiniteScroll: getInfiniteScrollPreference('following'),
      },
      'followers-feed': {
        selectedTypes: getTypePreference('followers') as PostType[],
        activityKinds: getFollowerFeedActivityKindsPreference(),
        infiniteScroll: getInfiniteScrollPreference('followers'),
      },
      activity: {
        selectedTypes: getTypePreference('timeline') as PostType[],
        activityKinds: getBlogActivityKindsPreference(),
        infiniteScroll: getInfiniteScrollPreference('timeline'),
      },
      social: {
        infiniteScroll: getInfiniteScrollPreference('social'),
      },
    };
  }

  private updateRoutePreference(route: PreferenceRoute, patch: Partial<RoutePreferenceState>): void {
    this.routePrefs = {
      ...this.routePrefs,
      [route]: {
        ...this.routePrefs[route],
        ...patch,
      },
    };
  }

  private resetRoutePreference(route: PreferenceRoute): void {
    switch (route) {
      case 'archive':
        setArchiveSortPreference(SORT_RESET);
        setTypePreference([...ALL_POST_TYPES], 'archive');
        setVariantPreference('all', 'archive');
        setGalleryMode('grid', 'archive');
        setInfiniteScrollPreference(true, 'archive');
        break;
      case 'search':
        setSearchSortPreference(SORT_RESET);
        setTypePreference([...ALL_POST_TYPES], 'search');
        setVariantPreference('all', 'search');
        setGalleryMode('grid', 'search');
        setInfiniteScrollPreference(true, 'search');
        break;
      case 'feed':
        setTypePreference([...ALL_POST_TYPES], 'following');
        setFollowingActivityKindsPreference([...DEFAULT_ACTIVITY_KINDS]);
        setInfiniteScrollPreference(true, 'following');
        break;
      case 'followers-feed':
        setTypePreference([...ALL_POST_TYPES], 'followers');
        setFollowerFeedActivityKindsPreference([...DEFAULT_ACTIVITY_KINDS]);
        setInfiniteScrollPreference(true, 'followers');
        break;
      case 'activity':
        setTypePreference([...ALL_POST_TYPES], 'timeline');
        setBlogActivityKindsPreference([...DEFAULT_ACTIVITY_KINDS]);
        setInfiniteScrollPreference(true, 'timeline');
        break;
      case 'social':
        setInfiniteScrollPreference(true, 'social');
        break;
    }
    this.routePrefs = this.readRoutePreferences();
  }

  private renderRoutePreferenceRow(
    route: PreferenceRoute,
    label: string,
    help: string,
    pageName: string,
    options: {
      showSort?: boolean;
      showTypes?: boolean;
      showVariants?: boolean;
      showActivityKinds?: boolean;
      showGalleryMode?: boolean;
      showInfiniteScroll?: boolean;
      onSortChange?: (value: string) => void;
      onActivityKindsChange?: (value: ActivityKind[]) => void;
    },
  ) {
    const state = this.routePrefs[route];
    return html`
      <div class="pref-row" id=${route}>
        <div class="pref-copy">
          <div class="pref-label">${label}</div>
          <div class="pref-help">${help}</div>
        </div>
        <div class="pref-controls">
          <control-panel
            .pageName=${pageName}
            .sortValue=${state.sortValue || SORT_RESET}
            .selectedTypes=${state.selectedTypes || []}
            .selectedVariants=${state.selectedVariants || []}
            .activityKinds=${state.activityKinds || []}
            .galleryMode=${state.galleryMode || 'grid'}
            .infiniteScroll=${state.infiniteScroll}
            .showSort=${options.showSort || false}
            .showTypes=${options.showTypes || false}
            .showVariants=${options.showVariants || false}
            .showActivityKinds=${options.showActivityKinds || false}
            .showGalleryMode=${options.showGalleryMode || false}
            .showInfiniteScroll=${options.showInfiniteScroll || false}
            @sort-change=${options.onSortChange ? ((e: CustomEvent) => options.onSortChange!(e.detail.value)) : null}
            @types-change=${(e: CustomEvent) => this.updateRoutePreference(route, { selectedTypes: e.detail.types })}
            @variant-change=${(e: CustomEvent) => this.updateRoutePreference(route, { selectedVariants: e.detail.variants || [] })}
            @activity-kinds-change=${options.onActivityKindsChange ? ((e: CustomEvent) => options.onActivityKindsChange!(normalizeActivityKinds((e.detail.activityKinds || []).join(',')))) : null}
            @gallery-mode-change=${(e: CustomEvent) => this.updateRoutePreference(route, { galleryMode: e.detail.value })}
            @infinite-toggle=${(e: CustomEvent) => this.updateRoutePreference(route, { infiniteScroll: e.detail.enabled })}
          ></control-panel>
        </div>
        <button class="pref-reset" type="button" @click=${() => this.resetRoutePreference(route)}>Reset</button>
      </div>
    `;
  }

  private renderBlogAvatar(blog: SettingsBlog) {
    const avatarUrl = normalizeAvatarUrl(blog.avatarUrl || '');
    const initial = blog.name.trim().charAt(0).toUpperCase() || '@';
    return avatarUrl
      ? html`
          <img
            class="modal-avatar"
            src=${avatarUrl}
            alt=${`Avatar for @${blog.name}`}
            @error=${handleAvatarImageError}
          />
        `
      : html`<div class="modal-avatar-fallback" aria-hidden="true">${initial}</div>`;
  }

  private renderSelectedBlogModal() {
    const blog = this.selectedBlog;
    if (!blog) {
      return null;
    }

    return html`
      <div class="modal-backdrop" @click=${() => this.closeBlog()}>
        <section
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-blog-title"
          @click=${(event: Event) => event.stopPropagation()}
        >
          <div class="modal-top">
            ${this.renderBlogAvatar(blog)}
            <h3 class="modal-title" id="settings-blog-title">@${blog.name}</h3>
            ${blog.title ? html`<div class="modal-subtitle">${blog.title}</div>` : ''}
            ${blog.description ? html`<div class="modal-description">${blog.description}</div>` : ''}
          </div>
          <div class="modal-meta">
            <span>${blog.postsCount ?? 0} posts</span>
            <span>${blog.followersCount ?? 0} followers</span>
          </div>
          <div class="modal-actions">
            <a class="modal-button primary" href=${buildPageUrl('settings', blog.name)}>
              Open blog settings
            </a>
            <button class="modal-button" type="button" aria-label="Close blog details" @click=${() => this.closeBlog()}>
              Close
            </button>
          </div>
        </section>
      </div>
    `;
  }

  render() {
    return html`
      <div class="wrap">
        <div class="eyebrow">Settings</div>
        <h1>Your account</h1>
        ${this.user?.username ? html`<div class="status">@${this.user.username}</div>` : ''}
        ${this.loading ? html`<div class="status">Loading settings…</div>` : ''}
        ${!this.loading && this.error ? html`<div class="error">Settings unavailable<br />${this.error}</div>` : ''}
        ${!this.loading && !this.error ? html`
          <div class="section">
            <div class="eyebrow">View preferences</div>
            <h2>Stored in this browser</h2>
            ${this.renderRoutePreferenceRow('archive', 'Archive', 'Default archive view controls.', 'archive', {
              showSort: true,
              showTypes: true,
              showVariants: true,
              showGalleryMode: true,
              showInfiniteScroll: true,
              onSortChange: (value) => {
                setArchiveSortPreference(normalizeSortValue(value));
                this.updateRoutePreference('archive', { sortValue: normalizeSortValue(value) });
              },
            })}
            ${this.renderRoutePreferenceRow('search', 'Search', 'Default search view controls.', 'search', {
              showSort: true,
              showTypes: true,
              showVariants: true,
              showGalleryMode: true,
              showInfiniteScroll: true,
              onSortChange: (value) => {
                setSearchSortPreference(normalizeSortValue(value));
                this.updateRoutePreference('search', { sortValue: normalizeSortValue(value) });
              },
            })}
            ${this.renderRoutePreferenceRow('feed', 'Feed', 'Default followed-posts controls.', 'following', {
              showTypes: true,
              showActivityKinds: true,
              showInfiniteScroll: true,
              onActivityKindsChange: (value) => {
                setFollowingActivityKindsPreference(value);
                this.updateRoutePreference('feed', { activityKinds: value });
              },
            })}
            ${this.renderRoutePreferenceRow('followers-feed', "Followers' Feed", 'Default follower-posts controls.', 'followers', {
              showTypes: true,
              showActivityKinds: true,
              showInfiniteScroll: true,
              onActivityKindsChange: (value) => {
                setFollowerFeedActivityKindsPreference(value);
                this.updateRoutePreference('followers-feed', { activityKinds: value });
              },
            })}
            ${this.renderRoutePreferenceRow('activity', 'Activity', 'Default blog activity controls.', 'timeline', {
              showTypes: true,
              showActivityKinds: true,
              showInfiniteScroll: true,
              onActivityKindsChange: (value) => {
                setBlogActivityKindsPreference(value);
                this.updateRoutePreference('activity', { activityKinds: value });
              },
            })}
            ${this.renderRoutePreferenceRow('social', 'Social', 'Default followers/following list behavior.', 'social', {
              showInfiniteScroll: true,
            })}
          </div>

          <div class="section">
            <div class="eyebrow">Owned blogs</div>
            <h2>Choose a blog</h2>
            <div class="cards">
              ${this.blogs.map((blog) => html`
                <button
                  class="card"
                  type="button"
                  aria-label=${`Open blog details for @${blog.name}`}
                  @click=${() => this.openBlog(blog)}
                >
                  <div class="card-summary">
                    <blog-identity
                      variant="micro"
                      .blogName=${blog.name}
                      .blogTitle=${blog.title || ''}
                      .blogDescription=${blog.description || ''}
                      .avatarUrl=${blog.avatarUrl || ''}
                    ></blog-identity>
                  </div>
                  <div class="meta">
                    <span>${blog.postsCount ?? 0} posts</span>
                    <span>${blog.followersCount ?? 0} followers</span>
                  </div>
                  <div class="cta">Open blog settings</div>
                </button>
              `)}
            </div>
          </div>
        ` : ''}
        ${this.renderSelectedBlogModal()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'view-settings-user': ViewSettingsUser;
  }
}
