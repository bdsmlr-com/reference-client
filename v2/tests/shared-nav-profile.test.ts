import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const NAV_FILE = join(process.cwd(), 'src/components/shared-nav.ts');

describe('shared-nav profile/settings behavior', () => {
  it('removes top nav Feed link and routes logo to feed context', () => {
    const src = readFileSync(NAV_FILE, 'utf8');
    const config = JSON.parse(readFileSync(join(process.cwd(), 'media-config.json'), 'utf8'));

    expect(src).not.toContain("{ name: 'feed', label: 'Feed'");
    expect(src).toContain('private getLogoLink()');
    expect(src).toContain("const link = resolveLink('nav_logo', { blog: primaryBlog });");
    expect(config.links.contexts.nav_logo.mode).toBe('internal');
    expect(config.links.contexts.nav_logo.pattern).toBe('/{blog}/feed');
    expect(config.links.contexts.nav_logo.labelTemplate).toBe('BDSMLR');
  });

  it('contains profile and settings menu with login + logout + gallery mode controls', () => {
    const src = readFileSync(NAV_FILE, 'utf8');

    expect(src).toContain('openLoginModal');
    expect(src).toContain('Log out');
    expect(src).toContain('Gallery view');
    expect(src).toContain('Clear cache');
  });

  it('uses log in label when logged out and avatar button when logged in', () => {
    const src = readFileSync(NAV_FILE, 'utf8');

    expect(src).toContain("const profileToggleLabel = loggedIn ? '' : 'Log in';");
    expect(src).toContain('class="profile-avatar"');
    expect(src).toContain('aria-label=${loggedIn ?');
  });

  it('clears stored primary blog on logout and opens empty login modal input', () => {
    const src = readFileSync(NAV_FILE, 'utf8');

    expect(src).toContain('clearStoredBlogName();');
    expect(src).toContain("this.usernameInput = '';");
  });

  it('normalizes avatar from either camelCase or snake_case API fields', () => {
    const src = readFileSync(NAV_FILE, 'utf8');

    expect(src).toContain('blog?.avatarUrl ?? blog?.avatar_url ?? null');
  });

  it('scrolls to top when clicking nav tabs on the same pathname', () => {
    const src = readFileSync(NAV_FILE, 'utf8');

    expect(src).toContain('if (target.pathname === window.location.pathname)');
    expect(src).toContain("window.scrollTo({ top: 0, behavior: 'smooth' });");
  });

  it('normalizes timeline page state back to the activity route when returning to the primary blog', () => {
    const src = readFileSync(NAV_FILE, 'utf8');

    expect(src).toContain("const page = this.currentPage === 'timeline' ? 'activity' : this.currentPage;");
    expect(src).toContain('const url = buildPageUrl(page, primaryBlog);');
  });

  it('keeps settings menu open while interacting with sort select controls', () => {
    const src = readFileSync(NAV_FILE, 'utf8');

    expect(src).toContain("if (activeEl && activeEl.tagName === 'SELECT') return;");
    expect(src).toContain('@click=${(e: Event) => e.stopPropagation()}');
    expect(src).toContain('@input=${this.handleArchiveSortPreferenceChange}');
    expect(src).toContain('@input=${this.handleSearchSortPreferenceChange}');
  });
});
