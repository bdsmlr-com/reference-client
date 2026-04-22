import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('blog identity integration', () => {
  it('adds a shared blog-identity component with deterministic accent and avatar fallback', () => {
    const src = readFileSync(join(ROOT, 'components/blog-identity.ts'), 'utf8');
    const avatarSrc = readFileSync(join(ROOT, 'services/avatar-url.ts'), 'utf8');

    expect(src).toContain("@customElement('blog-identity')");
    expect(src).toContain("@property({ type: String }) blogName = '';");
    expect(src).toContain("@property({ type: String }) blogTitle = '';");
    expect(src).toContain("@property({ type: String }) avatarUrl = '';");
    expect(src).toContain("@property({ type: String, reflect: true }) variant: BlogIdentityVariant = 'header';");
    expect(src).toContain('deriveAccentColor(');
    expect(src).toContain('avatar-fallback');
    expect(src).toContain("from '../services/avatar-url.js'");
    expect(avatarSrc).toContain('export function normalizeAvatarUrl');
  });

  it('renders blog-identity in blog-header and passes title and avatar props through archive and activity pages', () => {
    const headerSrc = readFileSync(join(ROOT, 'components/blog-header.ts'), 'utf8');
    const archiveSrc = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(headerSrc).toContain("import './blog-identity.js';");
    expect(headerSrc).toContain("type PageName = 'archive' | 'timeline' | 'social' | 'following' | 'activity';");
    expect(headerSrc).toContain('<blog-identity');
    expect(headerSrc).toContain('.blogTitle=${this.blogTitle}');
    expect(headerSrc).toContain('.avatarUrl=${this.avatarUrl}');

    expect(archiveSrc).toContain('.avatarUrl=${this.blogData?.avatarUrl || \'\'}');
    expect(postsSrc).toContain('page="activity"');
    expect(postsSrc).toContain('.avatarUrl=${this.blogData?.avatarUrl || \'\'}');
  });

  it('reuses blog-identity in the shared-nav profile menu with compact menu variant', () => {
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');

    expect(navSrc).toContain("import './blog-identity.js';");
    expect(navSrc).toContain('profileBlogTitle');
    expect(navSrc).toContain('<blog-identity');
    expect(navSrc).toContain('variant="menu"');
    expect(navSrc).toContain('.blogTitle=${this.profileBlogTitle ?? \'\'}');
  });

  it('derives accent color locally instead of depending on backend accent fields', () => {
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');
    const archiveSrc = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');
    const identitySrc = readFileSync(join(ROOT, 'components/blog-identity.ts'), 'utf8');
    const headerSrc = readFileSync(join(ROOT, 'components/blog-header.ts'), 'utf8');

    expect(navSrc).not.toContain('profileBlogAccentColor');
    expect(navSrc).not.toContain('accent_color');
    expect(navSrc).not.toContain('accentColor?');
    expect(archiveSrc).not.toContain('blogData?.accentColor');
    expect(postsSrc).not.toContain('blogData?.accentColor');
    expect(identitySrc).not.toContain("@property({ type: String }) accentColor = '';");
    expect(identitySrc).not.toContain('const explicit = this.accentColor.trim();');
    expect(headerSrc).not.toContain("@property({ type: String }) accentColor = '';");
    expect(headerSrc).not.toContain('.accentColor=${this.accentColor}');
  });
});
