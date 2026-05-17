import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('settings user modal', () => {
  it('opens owned blogs in a centered modal instead of direct card navigation', () => {
    const src = readFileSync(join(ROOT, 'pages/view-settings-user.ts'), 'utf8');

    expect(src).toContain("@state() private selectedBlog: SettingsBlog | null = null;");
    expect(src).toContain('private openBlog(blog: SettingsBlog): void');
    expect(src).toContain('private renderSelectedBlogModal()');
    expect(src).toContain('class="modal-backdrop"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain('handleAvatarImageError');
    expect(src).toContain('normalizeAvatarUrl');
    expect(src).toContain('variant="micro"');
    expect(src).toContain('Open blog settings');
    expect(src).not.toContain('<a class="card" href=');
  });

  it('keeps locked view preferences visible and routes locked settings interactions to the roadblock modal', () => {
    const src = readFileSync(join(ROOT, 'pages/view-settings-user.ts'), 'utf8');

    expect(src).toContain("import { getViewerCapabilities } from '../services/viewer-capabilities.js';");
    expect(src).toContain("use_archive_non_newest_sort");
    expect(src).toContain("use_archive_variant_filters");
    expect(src).toContain("use_masonry");
    expect(src).toContain('private lockedArchiveSortValues(): string[]');
    expect(src).toContain('private lockedArchiveVariantSelections(): Array<');
    expect(src).toContain('private lockedGalleryModes(): GalleryMode[]');
    expect(src).toContain('.lockedSortValues=${options.lockedSortValues || []}');
    expect(src).toContain('.lockedVariantSelections=${options.lockedVariantSelections || []}');
    expect(src).toContain('.lockedGalleryModes=${options.lockedGalleryModes || []}');
    expect(src).toContain('@sort-option-locked=${options.onSortLocked ?');
    expect(src).toContain('@variant-option-locked=${options.onVariantLocked ?');
    expect(src).toContain('@gallery-mode-locked=${options.onGalleryLocked ?');
    expect(src).toContain('private renderSettingsRoadblockModal()');
    expect(src).toContain('this.settingsRoadblock.kind === \'sort\'');
    expect(src).toContain('this.settingsRoadblock.kind === \'variant\'');
    expect(src).toContain('Masonry layout is locked');
    expect(src).toContain('Upgrade to unlock this control and keep browsing without restrictions.');
    expect(src).toContain("window.addEventListener('auth-user-changed', this.handleAuthUserChanged as EventListener);");
    expect(src).toContain("this.routePrefs = this.readRoutePreferences();");
    expect(src).not.toContain('archive_masonry_visible');
    expect(src).not.toContain('search_max_results_high');
  });
});
