import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles, getStoredTheme, setStoredTheme, type Theme } from '../styles/theme.js';
import {
  getPrimaryBlogName,
  getViewedBlogName,
  buildPageUrl,
  isDevMode,
  setStoredBlogName,
  clearStoredBlogName,
} from '../services/blog-resolver.js';
import {
  getCurrentUsername,
  isLoggedIn,
  clearCurrentUsername,
  setCurrentUsername,
  getGalleryMode,
  setGalleryMode,
  PROFILE_EVENTS,
  type GalleryMode,
  getArchiveSortPreference,
  setArchiveSortPreference,
  getSearchSortPreference,
  setSearchSortPreference,
} from '../services/profile.js';
import { apiClient } from '../services/client.js';
import { getAuthUser, updateActiveBlog } from '../state/auth-state.js';
import { setStoredActiveBlog, clearStoredActiveBlog } from '../utils/storage.js';
import { BREAKPOINTS } from '../types/ui-constants.js';
import { SORT_OPTIONS, normalizeSortValue } from '../types/post.js';
import { resolveLink } from '../services/link-resolver.js';
import { logout as legacyLogout, login as legacyLogin } from '../services/auth-service.js';
import { normalizeAvatarUrl } from '../services/avatar-url.js';
import './blog-identity.js';

type PageName = 'search' | 'blogs' | 'archive' | 'timeline' | 'following' | 'social' | 'posts';
const BUILD_TAG = (import.meta as any).env?.VITE_BUILD_SHA || 'staging@unknown/unknown';

@customElement('shared-nav')
export class SharedNav extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 50;
      }

      .nav-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .logo {
        font-size: 16px;
        font-weight: 700;
        color: var(--accent);
        text-decoration: none;
      }

      .logo:hover {
        text-decoration: none;
        opacity: 0.9;
      }

      nav {
        display: flex;
        gap: 2px;
        flex-wrap: wrap;
      }

      .nav-link {
        padding: 6px 10px;
        border-radius: 4px;
        background: transparent;
        color: var(--text-muted);
        font-size: 13px;
        text-decoration: none;
        transition: all 0.2s;
      }

      .nav-link:hover {
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        text-decoration: none;
      }

      .nav-link.active {
        background: var(--accent);
        color: white;
      }

      .right-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        position: relative;
      }

      .theme-toggle,
      .profile-toggle,
      .menu-button,
      .gallery-toggle {
        padding: 6px 10px;
        border-radius: 4px;
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font-size: 13px;
        border: 1px solid var(--border);
        transition: background 0.2s;
        min-height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
      }

      .theme-toggle {
        font-size: 16px;
        min-width: 36px;
      }

      .profile-toggle {
        min-width: 36px;
        gap: 6px;
      }

      .profile-avatar {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        object-fit: cover;
        display: block;
      }

      .profile-avatar-fallback {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--accent);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .theme-toggle:hover,
      .profile-toggle:hover,
      .menu-button:hover,
      .gallery-toggle:hover {
        background: var(--border-strong);
      }

      .gallery-toggle.active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .profile-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 260px;
        background: var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 8px;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 120;
      }

      .menu-build-tag {
        border-top: 1px solid var(--border);
        color: var(--text-muted);
        font-size: 10px;
        letter-spacing: 0.03em;
        margin-top: 4px;
        padding-top: 8px;
      }

      .menu-section-title {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .current-user {
        font-size: 13px;
        color: var(--text-primary);
        font-weight: 600;
      }

      .profile-blog-identity {
        display: block;
      }

      .gallery-row {
        display: flex;
        gap: 6px;
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
        width: min(420px, 100%);
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

      .modal input {
        width: 100%;
        min-height: 36px;
        padding: 8px 10px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--bg-primary);
        color: var(--text-primary);
      }

      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .viewing-indicator {
        font-size: 11px;
        color: var(--text-muted);
        background: var(--bg-panel-alt);
        padding: 2px 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }

      .viewing-indicator .blog-name {
        color: var(--accent);
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .viewing-indicator .reset-link {
        color: var(--text-muted);
        text-decoration: underline;
        cursor: pointer;
        font-size: 10px;
      }

      .viewing-indicator .reset-link:hover {
        color: var(--accent);
      }

      @media (max-width: ${unsafeCSS(BREAKPOINTS.MOBILE)}px) {
        .nav-container {
          flex-wrap: wrap;
          justify-content: center;
        }

        .logo {
          width: 100%;
          text-align: center;
          margin-bottom: 4px;
        }

        nav {
          justify-content: center;
        }

        .right-controls {
          width: 100%;
          justify-content: center;
          flex-wrap: wrap;
        }

        .profile-menu {
          right: 50%;
          transform: translateX(50%);
          width: min(320px, calc(100vw - 24px));
        }
      }
    `,
  ];

  @property({ type: String }) currentPage: PageName = 'search';
  @state() private theme: Theme = getStoredTheme();
  @state() private menuOpen = false;
  @state() private loginModalOpen = false;
  @state() private usernameInput = '';
  @state() private passwordInput = '';
  @state() private currentUsername: string | null = getCurrentUsername();
  @state() private galleryMode: GalleryMode = getGalleryMode();
  @state() private profileAvatarUrl: string | null = null;
  @state() private profileBlogTitle: string | null = null;
  @state() private archiveSortPreference = normalizeSortValue(getArchiveSortPreference() || 'newest');
  @state() private searchSortPreference = normalizeSortValue(getSearchSortPreference() || 'newest');
  @state() private loginError: string | null = null;
  @state() private blogs: { id: number; name: string }[] = [];
  @state() private activeBlogId: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this.handleDocumentClick);
    window.addEventListener(PROFILE_EVENTS.usernameChanged, this.handleProfileStateChange as EventListener);
    window.addEventListener(PROFILE_EVENTS.galleryModeChanged, this.handleProfileStateChange as EventListener);
    window.addEventListener(PROFILE_EVENTS.sortPreferencesChanged, this.handleProfileStateChange as EventListener);
    window.addEventListener('auth-user-changed', this.handleAuthChanged as EventListener);
    this.syncFromAuth();
    void this.refreshProfileIdentity();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleDocumentClick);
    window.removeEventListener(PROFILE_EVENTS.usernameChanged, this.handleProfileStateChange as EventListener);
    window.removeEventListener(PROFILE_EVENTS.galleryModeChanged, this.handleProfileStateChange as EventListener);
    window.removeEventListener(PROFILE_EVENTS.sortPreferencesChanged, this.handleProfileStateChange as EventListener);
    window.removeEventListener('auth-user-changed', this.handleAuthChanged as EventListener);
  }

  private handleDocumentClick = (e: MouseEvent): void => {
    if (!this.menuOpen) return;
    const path = e.composedPath();
    if (path.includes(this)) return;
    const activeEl = (this.shadowRoot?.activeElement || document.activeElement) as HTMLElement | null;
    if (activeEl && activeEl.tagName === 'SELECT') return;
    this.menuOpen = false;
  };

  private handleProfileStateChange = (): void => {
    this.currentUsername = getCurrentUsername();
    this.galleryMode = getGalleryMode();
    this.archiveSortPreference = normalizeSortValue(getArchiveSortPreference() || 'newest');
    this.searchSortPreference = normalizeSortValue(getSearchSortPreference() || 'newest');
    void this.refreshProfileIdentity();
  };

  private handleAuthChanged = (e: CustomEvent): void => {
    const user = e.detail;
    this.applyAuthUser(user);
  };

  private syncFromAuth(): void {
    this.applyAuthUser(getAuthUser());
  }

  private applyAuthUser(user: any): void {
    if (user) {
      this.blogs = user.blogs || [];
      this.activeBlogId = user.activeBlogId || user.blogId || null;
      let activeName =
        user.activeBlogName ||
        (this.blogs.find((b) => b.id === this.activeBlogId)?.name) ||
        user.blogName ||
        null;
      if (!activeName && this.blogs.length > 0) {
        activeName = this.blogs[0].name;
        this.activeBlogId = this.blogs[0].id;
      }
      if (activeName) {
        setCurrentUsername(activeName);
        setStoredBlogName(activeName);
        this.currentUsername = activeName;
      }
    } else {
      this.blogs = [];
      this.activeBlogId = null;
      this.currentUsername = null;
      this.profileAvatarUrl = null;
      this.profileBlogTitle = null;
    }
    void this.refreshProfileIdentity();
  };

  private async refreshProfileIdentity(): Promise<void> {
    const username = this.currentUsername;
    if (!username) {
      this.profileAvatarUrl = null;
      this.profileBlogTitle = null;
      return;
    }

    try {
      const response = await apiClient.blogs.get({ blog_name: username });
      if (this.currentUsername !== username) {
        return;
      }
      const blog = response.blog as {
        avatarUrl?: string;
        avatar_url?: string;
        title?: string;
      } | undefined;
      this.profileAvatarUrl = normalizeAvatarUrl(blog?.avatarUrl ?? blog?.avatar_url ?? null);
      this.profileBlogTitle = blog?.title ?? null;
    } catch {
      if (this.currentUsername === username) {
        this.profileAvatarUrl = null;
        this.profileBlogTitle = null;
      }
    }
  }

  private toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    setStoredTheme(this.theme);
  }

  private getPageUrl(page: string): string {
    const activeBlog = this.currentUsername || getPrimaryBlogName() || getViewedBlogName();
    const blogPages = ['archive', 'posts', 'feed', 'social'];
    if (page === 'activity') {
      if (activeBlog) return buildPageUrl('activity', activeBlog);
      // Never emit bare /activity (invalid route). Fall back to home.
      return this.getHomeUrl();
    }

    if (blogPages.includes(page) && activeBlog) {
      return buildPageUrl(page, activeBlog);
    }
    return buildPageUrl(page);
  }

  private handleNavLinkClick(e: Event, href: string): void {
    const target = new URL(href, window.location.origin);
    if (target.pathname === window.location.pathname) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private getLogoLink(): { href: string; label: string; title: string } {
    const primaryBlog = this.currentUsername || getCurrentUsername() || getPrimaryBlogName();
    if (primaryBlog) {
      const link = resolveLink('nav_logo', { blog: primaryBlog });
      return {
        href: link.href,
        label: link.label || 'BDSMLR',
        title: link.title || 'Go to feed',
      };
    }
    // If no blog yet (unauthenticated), keep users on home.
    return {
      href: this.getHomeUrl(),
      label: 'BDSMLR',
      title: 'Go to home',
    };
  }

  private getHomeUrl(): string {
    return isDevMode() ? 'home.html' : '/';
  }

  private getClearCacheUrl(): string {
    return isDevMode() ? 'clear-cache.html' : '/clear-cache';
  }

  private isViewingDifferentBlog(): boolean {
    const primaryBlog = getPrimaryBlogName();
    const viewedBlog = getViewedBlogName();

    if (!primaryBlog || !viewedBlog) {
      return false;
    }

    return primaryBlog.toLowerCase() !== viewedBlog.toLowerCase();
  }

  private handleBackToPrimary(): void {
    const primaryBlog = getPrimaryBlogName();
    if (primaryBlog) {
      const page = this.currentPage === 'timeline' ? 'activity' : this.currentPage;
      const url = buildPageUrl(page, primaryBlog);
      window.location.href = url;
    }
  }

  private toggleProfileMenu(e: Event): void {
    e.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  private openLoginModal(): void {
    this.menuOpen = false;
    this.loginModalOpen = true;
    this.usernameInput = '';
    this.passwordInput = '';
    this.loginError = null;
  }

  private closeLoginModal(): void {
    this.loginModalOpen = false;
    this.usernameInput = '';
  }

  private async submitLogin(): Promise<void> {
    const normalized = this.usernameInput.trim().replace(/^@/, '');
    const password = this.passwordInput;
    if (!normalized || !password) {
      this.loginError = 'Enter username and password';
      return;
    }
    this.loginError = null;
    try {
      const resp = await legacyLogin(normalized, password, true);
      if (resp && typeof resp.user_id === 'number') {
        const blogs = resp.blogs || [];
        const primary = resp.primary_blog_id || blogs[0]?.id || resp.blog_id || null;
        const activeId = primary;
        const activeName = blogs.find((b: any) => b.id === activeId)?.name || resp.blog_name || normalized;
        setStoredActiveBlog(resp.user_id, activeId || 0);
        setCurrentUsername(activeName);
        setStoredBlogName(activeName);
        updateActiveBlog(activeId || resp.blog_id || 0, activeName);
        this.currentUsername = activeName;
        this.loginModalOpen = false;
        window.location.href = `/${activeName}/activity`;
      } else {
        this.loginError = 'Login failed';
      }
    } catch (err: any) {
      this.loginError = 'Login failed';
    }
  }

  private handleLogout(): void {
    this.menuOpen = false;
    void legacyLogout().finally(() => {
      const user = getAuthUser();
      if (user) {
        clearStoredActiveBlog(user.userId);
      }
      clearCurrentUsername();
      clearStoredBlogName();
      this.currentUsername = null;
      this.profileAvatarUrl = null;
      this.profileBlogTitle = null;
      window.location.href = '/';
    });
  }

  private handleGalleryMode(mode: GalleryMode): void {
    setGalleryMode(mode);
    this.galleryMode = mode;
  }

  private handleArchiveSortPreferenceChange(e: Event): void {
    const value = normalizeSortValue((e.target as HTMLSelectElement).value);
    this.archiveSortPreference = value;
    setArchiveSortPreference(value);
  }

  private handleSearchSortPreferenceChange(e: Event): void {
    const value = normalizeSortValue((e.target as HTMLSelectElement).value);
    this.searchSortPreference = value;
    setSearchSortPreference(value);
  }

  private handleBlogSwitch(e: Event): void {
    const user = getAuthUser();
    if (!user) return;
    const selected = parseInt((e.target as HTMLSelectElement).value, 10);
    if (!Number.isFinite(selected)) return;
    const selectedBlog = (user.blogs || []).find((b) => b.id === selected);
    if (!selectedBlog) return;
    setStoredActiveBlog(user.userId, selectedBlog.id);
    updateActiveBlog(selectedBlog.id, selectedBlog.name);
    setCurrentUsername(selectedBlog.name);
    setStoredBlogName(selectedBlog.name);
    this.currentUsername = selectedBlog.name;
    this.activeBlogId = selectedBlog.id;
    void this.refreshProfileIdentity();
    // Rebuild URLs for current page
    const currentPath = window.location.pathname;
    if (currentPath === '/' || currentPath === '') {
      window.location.href = `/${selectedBlog.name}/activity`;
    }
  }

  private renderProfileMenu() {
    const loggedIn = isLoggedIn();

    return html`
      <div class="profile-menu" role="menu" aria-label="Profile and settings menu" @click=${(e: Event) => e.stopPropagation()}>
        ${loggedIn
          ? html`
              <blog-identity
                class="profile-blog-identity"
                variant="menu"
                .blogName=${this.currentUsername ?? ''}
                .blogTitle=${this.profileBlogTitle ?? ''}
                .avatarUrl=${this.profileAvatarUrl ?? ''}
              ></blog-identity>
              <div class="menu-section-title">Routes</div>
              <a class="menu-button" href="/for/you">For you</a>
              <a class="menu-button" href=${buildPageUrl('feed', this.currentUsername || getPrimaryBlogName() || getViewedBlogName() || '')}>Feed</a>
              <a class="menu-button" href=${buildPageUrl('follower-feed', this.currentUsername || getPrimaryBlogName() || getViewedBlogName() || '')}>Follower Feed</a>
              <div class="menu-section-title">Settings</div>
              <a class="menu-button" href="/settings/you">Settings</a>
              ${this.blogs && this.blogs.length > 1
                ? html`
                    <label class="menu-section-title" for="blog-switcher">Active blog</label>
                    <select
                      id="blog-switcher"
                      class="menu-button"
                      .value=${String(this.activeBlogId ?? '')}
                      @change=${(e: Event) => this.handleBlogSwitch(e)}
                    >
                      ${this.blogs.map((b) => html`<option value=${b.id}>@${b.name}</option>`)}
                    </select>
                  `
                : ''}
              <div class="menu-section-title">Gallery view</div>
              <div class="gallery-row" aria-label="Gallery view">
                <button
                  class="gallery-toggle ${this.galleryMode === 'grid' ? 'active' : ''}"
                  @click=${() => this.handleGalleryMode('grid')}
                >Grid</button>
                <button
                  class="gallery-toggle ${this.galleryMode === 'masonry' ? 'active' : ''}"
                  @click=${() => this.handleGalleryMode('masonry')}
                >Masonry</button>
              </div>
              <div class="menu-section-title">Archive default sort</div>
              <select class="menu-button" .value=${this.archiveSortPreference} @change=${this.handleArchiveSortPreferenceChange} @input=${this.handleArchiveSortPreferenceChange}>
                ${SORT_OPTIONS.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
              </select>
              <div class="menu-section-title">Search default sort</div>
              <select class="menu-button" .value=${this.searchSortPreference} @change=${this.handleSearchSortPreferenceChange} @input=${this.handleSearchSortPreferenceChange}>
                ${SORT_OPTIONS.map((opt) => html`<option value=${opt.value}>${opt.label}</option>`)}
              </select>
              <a class="menu-button" href=${this.getClearCacheUrl()}>Clear cache</a>
              <button class="menu-button" @click=${this.handleLogout}>Log out</button>
              <div class="menu-build-tag" aria-label="Build tag">${BUILD_TAG}</div>
            `
          : html`
              <div class="menu-section-title">Settings</div>
              <button class="menu-button" @click=${this.openLoginModal}>Log in</button>
              <a class="menu-button" href=${this.getClearCacheUrl()}>Clear cache</a>
              <div class="menu-build-tag" aria-label="Build tag">${BUILD_TAG}</div>
            `}
      </div>
    `;
  }

  private renderLoginModal() {
    if (!this.loginModalOpen) {
      return '';
    }

    return html`
      <div class="modal-backdrop" @click=${this.closeLoginModal}>
        <section class="modal" role="dialog" aria-label="Login" @click=${(e: Event) => e.stopPropagation()}>
          <h3>Log in</h3>
          <p>Enter your blog username and password (checked against bdsmlr.com).</p>
          <input
            type="text"
            placeholder="username"
            .value=${this.usernameInput}
            @input=${(e: Event) => (this.usernameInput = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.submitLogin()}
          />
          <input
            type="password"
            placeholder="password"
            .value=${this.passwordInput}
            @input=${(e: Event) => (this.passwordInput = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.submitLogin()}
          />
          ${this.loginError ? html`<div class="error">${this.loginError}</div>` : ''}
          <div class="modal-actions">
            <button class="menu-button" @click=${this.closeLoginModal}>Cancel</button>
            <button class="menu-button" @click=${this.submitLogin}>Log in</button>
          </div>
        </section>
      </div>
    `;
  }

  render() {
    const pages = [
      { name: 'activity', label: 'Activity', description: "A blog's full timeline including reblogs, likes, and comments" },
      { name: 'archive', label: 'Archive', description: 'High-density matrix of all blog interactions' },
      { name: 'social', label: 'Connections', description: 'View who follows a blog and who they follow' },
      { name: 'blogs', label: 'Discover', description: 'Discover blogs by name or description' },
      { name: 'search', label: 'Search', description: 'Search posts by tags with boolean syntax' },
    ];

    const viewedBlog = getViewedBlogName();
    const showViewingIndicator = this.isViewingDifferentBlog();
    const activePage = this.currentPage === 'following' ? '' : (this.currentPage === 'timeline' ? 'activity' : this.currentPage);
    const loggedIn = isLoggedIn();
    const profileToggleLabel = loggedIn ? '' : 'Log in';
    const profileInitial = (this.currentUsername || 'u').charAt(0).toUpperCase();
    const logoLink = this.getLogoLink();

    return html`
      <header class="nav-container">
        <a href=${logoLink.href} class="logo" title=${logoLink.title} aria-label=${logoLink.title}>${logoLink.label}</a>
        <nav aria-label="Main navigation">
          ${pages.map(
            (page) => {
              const href = this.getPageUrl(page.name);
              return html`
              <a
                href=${href}
                class="nav-link ${activePage === page.name ? 'active' : ''}"
                title=${page.description}
                aria-current=${activePage === page.name ? 'page' : 'false'}
                @click=${(e: Event) => this.handleNavLinkClick(e, href)}
              >
                ${page.label}
              </a>
            `;
            }
          )}
        </nav>
        ${showViewingIndicator
          ? html`
              <span class="viewing-indicator" title="You're viewing another blog - nav links go to your primary blog">
                <span aria-hidden="true">👁️</span>
                <span class="blog-name">@${viewedBlog}</span>
                <span
                  class="reset-link"
                  @click=${this.handleBackToPrimary}
                  role="button"
                  tabindex="0"
                  aria-label="Go back to your primary blog"
                  @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.handleBackToPrimary()}
                >back</span>
              </span>
            `
          : ''}
        <div class="right-controls">
          <button
            class="theme-toggle"
            @click=${this.toggleTheme}
            title="Toggle theme"
            aria-label=${this.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span aria-hidden="true">${this.theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          <button
            class="profile-toggle"
            @click=${this.toggleProfileMenu}
            aria-label=${loggedIn ? `Open profile and settings for @${this.currentUsername}` : 'Log in'}
          >
            ${loggedIn
              ? this.profileAvatarUrl
                ? html`<img class="profile-avatar" src=${this.profileAvatarUrl} alt=${`@${this.currentUsername} avatar`} />`
                : html`<span class="profile-avatar-fallback" aria-hidden="true">${profileInitial}</span>`
              : profileToggleLabel}
          </button>
          ${this.menuOpen ? this.renderProfileMenu() : ''}
        </div>
      </header>
      ${this.renderLoginModal()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'shared-nav': SharedNav;
  }
}
