import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('archive/search render contract usage', () => {
  it('archive and search pages pull loading card config from render contract', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(process.cwd(), 'src/pages/view-search.ts'), 'utf8');

    expect(archiveSrc).toContain("import { getPageSlotConfig } from '../services/render-page.js';");
    expect(searchSrc).toContain("import { getPageSlotConfig } from '../services/render-page.js';");
    expect(archiveSrc).toContain('cardType=${this.mainSlotConfig.loading?.cardType');
    expect(searchSrc).toContain('cardType=${this.mainSlotConfig.loading?.cardType');
    expect(archiveSrc).toContain('count=${this.mainSlotConfig.loading?.count');
    expect(searchSrc).toContain('count=${this.mainSlotConfig.loading?.count');
  });

  it('archive and search consume canonical posts instead of backend timelineItems', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(process.cwd(), 'src/pages/view-search.ts'), 'utf8');

    expect(archiveSrc).toContain('materializeSearchResultUnits(resp)');
    expect(archiveSrc).toContain('resultUnits');
    expect(searchSrc).toContain('materializeSearchResultUnits(resp)');
    expect(archiveSrc).not.toContain('(resp.timelineItems || []).forEach');
    expect(searchSrc).not.toContain('(resp.timelineItems || []).forEach');
  });

  it('archive and search both expose q-driven content query inputs', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(process.cwd(), 'src/pages/view-search.ts'), 'utf8');

    expect(archiveSrc).toContain('readContentRouteUrlState({');
    expect(archiveSrc).toContain('q: this.query.trim() || undefined');
    expect(archiveSrc).toContain('placeholder="Filter this archive with free text or tag:..."');
    expect(archiveSrc).toContain('<archive-tag-cloud');
    expect(archiveSrc).toContain('.error=${this.archiveTagsError}');
    expect(searchSrc).toContain('readContentRouteUrlState({');
    expect(searchSrc).toContain('tag_name: this.query');
  });

  it('archive keeps initial loading and tag cloud failures separate from content results state', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');

    expect(archiveSrc).toContain("@state() private archiveTagsError = '';");
    expect(archiveSrc).toContain('void this.loadArchiveTagCloud();');
    expect(archiveSrc).toContain('await this.loadPosts({ preserveNavigationState: true });');
    expect(archiveSrc).toContain("this.initialLoading && !this.blogId ? html`<loading-spinner message=\"Loading archive...\"></loading-spinner>` : ''");
    expect(archiveSrc).toContain("this.errorMessage = '';");
  });

  it('archive now rides the archive posts contract with session paging and blog scope', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');

    expect(archiveSrc).toContain('session_id: this.searchSessionId || undefined');
    expect(archiveSrc).toContain('page_number: targetPage');
    expect(archiveSrc).toContain('apiClient.posts.listCached({');
    expect(archiveSrc).toContain("activity_kinds: ['post', 'reblog']");
    expect(archiveSrc).toContain('blog_id: this.blogId');
  });
});
