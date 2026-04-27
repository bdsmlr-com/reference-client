import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('settings route pages', () => {
  it('routes /settings/you and /settings/:blogname to dedicated settings views', () => {
    const src = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(src).toContain("import './pages/view-settings-user.js';");
    expect(src).toContain("import './pages/view-settings-blog.js';");
    expect(src).toContain("path: '/settings/you'");
    expect(src).toContain("<view-settings-user></view-settings-user>");
    expect(src).toContain("path: '/settings/:blogname'");
    expect(src).toContain("<view-settings-blog .blog=");
    expect(src).not.toContain("path: '/settings/:blogname', render: ({ blogname }) => html`<view-social");
  });

  it('links the profile menu to /settings/you', () => {
    const src = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');

    expect(src).toContain("href=\"/settings/you\"");
    expect(src).toContain("href=\"/for/you\"");
    expect(src).toContain("buildPageUrl('follower-feed'");
    expect(src).toContain('>Settings</a>');
  });

  it('implements dedicated user and blog settings pages that use auth settings endpoints', () => {
    const userSrc = readFileSync(join(ROOT, 'pages/view-settings-user.ts'), 'utf8');
    const blogSrc = readFileSync(join(ROOT, 'pages/view-settings-blog.ts'), 'utf8');

    expect(userSrc).toContain('getStatus, getUserSettings');
    expect(userSrc).toContain("customElement('view-settings-user')");
    expect(userSrc).toContain("buildPageUrl('settings',");
    expect(blogSrc).toContain('getBlogSettings');
    expect(blogSrc).toContain("customElement('view-settings-blog')");
  });
});
