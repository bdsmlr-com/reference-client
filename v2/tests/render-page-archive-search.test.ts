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

  it('archive and search gate masonry through the canonical use_masonry capability', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(process.cwd(), 'src/pages/view-search.ts'), 'utf8');

    expect(archiveSrc).toContain("viewerHasCapability('use_masonry')");
    expect(searchSrc).toContain("viewerHasCapability('use_masonry')");
    expect(archiveSrc).toContain('.lockedGalleryModes=${this.lockedGalleryModes()}');
    expect(searchSrc).toContain('.lockedGalleryModes=${this.lockedGalleryModes()}');
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
    expect(archiveSrc).toContain('apiClient.posts.list({');
    expect(archiveSrc).toContain("activity_kinds: ['post', 'reblog']");
    expect(archiveSrc).toContain('blog_id: this.blogId');
  });

  it('archive gates non-newest sort and variant filters behind supporter capabilities', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');

    expect(archiveSrc).toContain("import { getViewerCapabilities, viewerHasCapability } from '../services/viewer-capabilities.js';");
    expect(archiveSrc).toContain(".lockedSortValues=${this.lockedArchiveSortValues()}");
    expect(archiveSrc).toContain(".lockedVariantSelections=${this.lockedArchiveVariantSelections()}");
    expect(archiveSrc).toContain('@sort-option-locked=${this.handleSortOptionLocked}');
    expect(archiveSrc).toContain('@variant-option-locked=${this.handleVariantOptionLocked}');
    expect(archiveSrc).toContain('Non-newest archive sorts are locked');
    expect(archiveSrc).toContain('Archive variant filters are locked');
    expect(archiveSrc).toContain('Upgrade to unlock this control and keep browsing without restrictions.');
  });

  it('archive normalization still opens the roadblock when locked url or restored preferences are stripped', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');

    expect(archiveSrc).toContain('normalizeArchiveSortValue(value: string, options: { showRoadblock?: boolean } = {})');
    expect(archiveSrc).toContain('normalizeArchiveVariants(variants: PostVariant[], options: { showRoadblock?: boolean } = {})');
    expect(archiveSrc).toContain("this.openArchiveRoadblock('sort')");
    expect(archiveSrc).toContain("this.openArchiveRoadblock('variant')");
    expect(archiveSrc).toContain("showRoadblock: Boolean(sortSource && sortSource !== 'newest')");
    expect(archiveSrc).toContain('showRoadblock: true');
  });

  it('archive normalization opens the roadblock when restored in-memory variants are stripped without a url override', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');

    expect(archiveSrc).toContain('} else {');
    expect(archiveSrc).toContain('this.selectedVariants = this.normalizeArchiveVariants(this.selectedVariants, { showRoadblock: true });');
  });

  it('archive and search normalize locked gallery mode back to grid at runtime without overwriting storage', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(process.cwd(), 'src/pages/view-search.ts'), 'utf8');
    const profileSrc = readFileSync(join(process.cwd(), 'src/services/profile.ts'), 'utf8');

    expect(profileSrc).toContain('normalizeGalleryModeForCapabilities');
    expect(archiveSrc).toContain("this.galleryMode = normalizeGalleryModeForCapabilities(getGalleryMode('archive'), this.viewerCapabilities);");
    expect(searchSrc).toContain("this.galleryMode = normalizeGalleryModeForCapabilities(getGalleryMode('search'), getViewerCapabilities());");
    expect(archiveSrc).not.toContain("setGalleryMode('grid'");
    expect(searchSrc).not.toContain("setGalleryMode('grid'");
  });

  it('archive load accounts for persisted variant preference before fetching posts', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');

    expect(archiveSrc).toContain("getVariantPreference('archive')");
    expect(archiveSrc).toContain('variantSelectionToPostVariants(savedVariants)');
    expect(archiveSrc).toContain("showRoadblock: savedVariants !== 'all' && savedVariants !== null");
  });
});
