import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import mediaConfig from '../media-config.json';

describe('social/blog-list render contract usage', () => {
  it('maps social list loading/card config from render contract', () => {
    const socialSrc = readFileSync(join(process.cwd(), 'src/pages/view-social.ts'), 'utf8');
    const listSrc = readFileSync(join(process.cwd(), 'src/components/blog-list.ts'), 'utf8');
    const render = (mediaConfig as any).render;

    expect(socialSrc).toContain("import { getPageSlotConfig } from '../services/render-page.js';");
    expect(socialSrc).toContain("getPageSlotConfig('social', 'main_stream')");
    expect(listSrc).toContain('social_blog');
    expect(listSrc).toContain("import './blog-identity.js';");
    expect(listSrc).toContain("import './media-renderer.js';");
    expect(listSrc).toContain("buildBlogPageUrl(item.blogName, 'activity')");
    expect(listSrc).toContain("grid-template-rows: minmax(96px, auto) 100px;");
    expect(listSrc).toContain('class="recent-grid"');
    expect(listSrc).toContain('<blog-identity');
    expect(socialSrc).toContain("type Tab = 'followers' | 'following' | 'siblings';");
    expect(socialSrc).toContain("apiClient.blogs.listFamily({ blog_id: this.blogId })");
    expect(socialSrc).toContain('Sibling Blogs');
    expect(socialSrc).not.toContain('await this.ensureSiblingBlogsLoaded();');
    expect(socialSrc).toContain("window.location.href = `/social/${encodeURIComponent(normalizedBlog)}/${tab}`;");
    expect(listSrc).not.toContain('apiClient.blogs.get(');
    expect(listSrc).not.toContain('apiClient.posts.list(');
    expect(render.pages.social.slots.main_stream.loading.cardType).toBe('social_blog_list');
    expect(render.cards.social_blog).toBeDefined();
  });

  it('check-render-contract script fails for ad hoc legacy card tags', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'render-contract-check-'));
    const badFile = join(fixtureDir, 'bad.ts');
    writeFileSync(badFile, '<post-feed-item></post-feed-item>\n', 'utf8');

    expect(() => {
      execFileSync('node', ['scripts/check-render-contract-usage.mjs', fixtureDir], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
    }).toThrow();
  });
});
