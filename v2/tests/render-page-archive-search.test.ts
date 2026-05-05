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

    expect(archiveSrc).toContain('applyRetrievalPostPolicies');
    expect(archiveSrc).toContain('(resp.posts || []).map');
    expect(searchSrc).toContain('materializeSearchResultUnits(resp)');
    expect(archiveSrc).toContain('postPolicies');
    expect(archiveSrc).not.toContain('(resp.timelineItems || []).forEach');
    expect(searchSrc).not.toContain('(resp.timelineItems || []).forEach');
  });
});
