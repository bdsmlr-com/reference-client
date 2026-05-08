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
    expect(listSrc).toContain("buildBlogPageUrl(normalized.blogName, 'activity')");
    expect(listSrc).toContain("grid-template-rows: minmax(96px, auto) 100px;");
    expect(listSrc).toContain('class="recent-grid"');
    expect(listSrc).toContain('page: { page_size: 3 }');
    expect(listSrc).toContain('<blog-identity');
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
