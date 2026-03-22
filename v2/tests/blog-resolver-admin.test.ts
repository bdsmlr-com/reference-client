import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAdminMode, syncAdminModeFromUrl } from '../src/services/blog-resolver.js';

describe('admin mode resolver', () => {
  const setItem = vi.fn();
  const removeItem = vi.fn();
  const getItem = vi.fn();

  beforeEach(() => {
    setItem.mockReset();
    removeItem.mockReset();
    getItem.mockReset();
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('localStorage', { setItem, removeItem, getItem });
  });

  it('isAdminMode is read-only and uses localStorage state', () => {
    getItem.mockReturnValue('true');
    expect(isAdminMode()).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('syncAdminModeFromUrl enables admin when query param is true', () => {
    vi.stubGlobal('window', { location: { search: '?admin=true' } });
    syncAdminModeFromUrl();
    expect(setItem).toHaveBeenCalledWith('bdsmlr_admin', 'true');
  });

  it('syncAdminModeFromUrl disables admin when query param is false', () => {
    vi.stubGlobal('window', { location: { search: '?admin=false' } });
    syncAdminModeFromUrl();
    expect(removeItem).toHaveBeenCalledWith('bdsmlr_admin');
  });
});
