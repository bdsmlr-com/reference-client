import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const NAV_FILE = join(process.cwd(), 'src/components/shared-nav.ts');

describe('shared-nav profile/settings behavior', () => {
  it('removes top nav Feed link and routes logo to feed context', () => {
    const src = readFileSync(NAV_FILE, 'utf8');

    expect(src).not.toContain("{ name: 'feed', label: 'Feed'");
    expect(src).toContain('private getLogoUrl()');
    expect(src).toContain("return buildPageUrl('feed', primaryBlog);");
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
});
