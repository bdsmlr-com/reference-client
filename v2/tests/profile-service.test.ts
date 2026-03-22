import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCurrentUsername,
  setCurrentUsername,
  clearCurrentUsername,
  clearProfileState,
  isLoggedIn,
  getGalleryMode,
  setGalleryMode,
  getArchiveSortPreference,
  setArchiveSortPreference,
  getSearchSortPreference,
  setSearchSortPreference,
} from '../src/services/profile.js';

describe('profile service', () => {
  const setItem = vi.fn();
  const getItem = vi.fn();
  const removeItem = vi.fn();

  beforeEach(() => {
    setItem.mockReset();
    getItem.mockReset();
    removeItem.mockReset();
    vi.stubGlobal('localStorage', { setItem, getItem, removeItem });
  });

  it('persists and clears username login state', () => {
    getItem.mockReturnValueOnce(null);
    expect(isLoggedIn()).toBe(false);

    setCurrentUsername('nonnudecuties');
    expect(setItem).toHaveBeenCalledWith('bdsmlr_profile_username', 'nonnudecuties');

    getItem.mockReturnValue('nonnudecuties');
    expect(getCurrentUsername()).toBe('nonnudecuties');
    expect(isLoggedIn()).toBe(true);

    clearCurrentUsername();
    expect(removeItem).toHaveBeenCalledWith('bdsmlr_profile_username');
  });

  it('stores gallery mode and defaults invalid values to grid', () => {
    getItem.mockReturnValueOnce(null);
    expect(getGalleryMode()).toBe('grid');

    setGalleryMode('masonry');
    expect(setItem).toHaveBeenCalledWith('bdsmlr_gallery_mode', 'masonry');

    getItem.mockReturnValueOnce('masonry');
    expect(getGalleryMode()).toBe('masonry');

    getItem.mockReturnValueOnce('unexpected');
    expect(getGalleryMode()).toBe('grid');
  });

  it('clears profile username and gallery mode together', () => {
    clearProfileState();
    expect(removeItem).toHaveBeenCalledWith('bdsmlr_profile_username');
    expect(removeItem).toHaveBeenCalledWith('bdsmlr_gallery_mode');
    expect(removeItem).toHaveBeenCalledWith('bdsmlr_archive_sort');
    expect(removeItem).toHaveBeenCalledWith('bdsmlr_search_sort');
  });

  it('stores and reads archive/search sort preferences separately', () => {
    setArchiveSortPreference('popular');
    setSearchSortPreference('newest');

    expect(setItem).toHaveBeenCalledWith('bdsmlr_archive_sort', 'popular');
    expect(setItem).toHaveBeenCalledWith('bdsmlr_search_sort', 'newest');

    getItem.mockImplementation((key: string) => {
      if (key === 'bdsmlr_archive_sort') return 'popular';
      if (key === 'bdsmlr_search_sort') return 'newest';
      return null;
    });

    expect(getArchiveSortPreference()).toBe('popular');
    expect(getSearchSortPreference()).toBe('newest');
  });
});
