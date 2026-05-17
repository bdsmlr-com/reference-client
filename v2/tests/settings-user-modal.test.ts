// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as authService from '../src/services/auth-service.js';
import {
  getArchiveSortPreference,
  getGalleryMode,
  setArchiveSortPreference,
  setGalleryMode,
} from '../src/services/profile.js';
import { getVariantPreference, setVariantPreference } from '../src/services/storage.js';
import { clearAuthUser, setAuthUser } from '../src/state/auth-state.js';
import '../src/pages/view-settings-user.js';

const ROOT = join(process.cwd(), 'src');

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('settings user modal', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAuthUser();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    clearAuthUser();
  });

  it('links blog cards to the dedicated blog settings modal instead of settings/blog routes', () => {
    const src = readFileSync(join(ROOT, 'pages/view-settings-user.ts'), 'utf8');

    expect(src).toContain("openBlog(blog: SettingsBlog)");
    expect(src).toContain('@click=${() => this.openBlog(blog)}');
    expect(src).toContain('renderSelectedBlogModal()');
    expect(src).toContain("buildPageUrl('settings', blog.name)");
    expect(src).toContain('Open blog settings');
    expect(src).not.toContain('<a class="card" href=');
  });

  it('keeps locked view preferences visible and routes locked settings interactions to the roadblock modal', () => {
    const src = readFileSync(join(ROOT, 'pages/view-settings-user.ts'), 'utf8');

    expect(src).toContain("import { getViewerCapabilities } from '../services/viewer-capabilities.js';");
    expect(src).toContain('use_archive_non_newest_sort');
    expect(src).toContain('use_archive_variant_filters');
    expect(src).toContain('use_masonry');
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
    expect(src).toContain("this.settingsRoadblock.kind === 'sort'");
    expect(src).toContain("this.settingsRoadblock.kind === 'variant'");
    expect(src).toContain('Masonry layout is locked');
    expect(src).toContain('Upgrade to unlock this control and keep browsing without restrictions.');
    expect(src).toContain("window.addEventListener('auth-user-changed', this.handleAuthUserChanged as EventListener);");
    expect(src).toContain('this.settingsRoadblock = null;');
    expect(src).not.toContain('archive_masonry_visible');
    expect(src).not.toContain('search_max_results_high');
  });

  it('normalizes locked saved prefs in settings without overwriting storage and unlocks them on auth change', async () => {
    vi.spyOn(authService, 'getStatus').mockResolvedValue({
      user_id: 1,
      blog_id: 1,
      blog_name: 'demo',
      username: 'demo',
      blogs: [{ id: 1, name: 'demo' }],
      capabilities: [],
    });
    vi.spyOn(authService, 'getUserSettings').mockResolvedValue({
      user: { id: 1, username: 'demo' },
      blogs: [{ id: 1, name: 'demo' }],
    });

    setArchiveSortPreference('popular');
    setVariantPreference('original', 'archive');
    setGalleryMode('masonry', 'archive');
    setGalleryMode('masonry', 'search');
    setAuthUser({
      userId: 1,
      blogId: 1,
      username: 'demo',
      blogName: 'demo',
      capabilities: [],
    });

    const el = document.createElement('view-settings-user') as any;

    try {
      document.body.appendChild(el);
      await flushMicrotasks();
      await el.updateComplete;
      await flushMicrotasks();
      await el.updateComplete;

      expect(el.routePrefs.archive.sortValue).toBe('newest');
      expect(el.routePrefs.archive.selectedVariants).toEqual([]);
      expect(el.routePrefs.archive.galleryMode).toBe('grid');
      expect(el.routePrefs.search.galleryMode).toBe('grid');

      expect(getArchiveSortPreference()).toBe('popular');
      expect(getVariantPreference('archive')).toBe('original');
      expect(getGalleryMode('archive')).toBe('masonry');
      expect(getGalleryMode('search')).toBe('masonry');

      el.openSettingsRoadblock('archive', 'gallery');
      await el.updateComplete;
      expect(el.shadowRoot?.textContent).toContain('Masonry layout is locked');

      setAuthUser({
        userId: 1,
        blogId: 1,
        username: 'demo',
        blogName: 'demo',
        capabilities: [
          'use_masonry',
          'use_archive_non_newest_sort',
          'use_archive_variant_filters',
        ],
      });
      await flushMicrotasks();
      await el.updateComplete;

      expect(el.settingsRoadblock).toBeNull();
      expect(el.routePrefs.archive.sortValue).toBe('popular');
      expect(el.routePrefs.archive.selectedVariants).toEqual([1]);
      expect(el.routePrefs.archive.galleryMode).toBe('masonry');
      expect(el.routePrefs.search.galleryMode).toBe('masonry');
      expect(el.shadowRoot?.textContent).not.toContain('Masonry layout is locked');
    } finally {
      el.remove();
    }
  });
});
