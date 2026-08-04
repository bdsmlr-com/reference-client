// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clearCurrentUsername, getCachedUsername, setCurrentUsername } from '../src/services/profile.js';
import * as blogMeta from '../src/services/blog-meta.js';
import '../src/components/shared-nav.js';
import { resolvePostAuthMode } from '../src/services/post-auth-mode.js';
import {
  clearAuthUser,
  getAuthState,
  isAuthCheckPending,
  setAuthChecking,
  setAuthUser,
} from '../src/state/auth-state.js';

class TestCustomEvent<T = unknown> extends Event {
  detail: T;

  constructor(type: string, init?: CustomEventInit<T>) {
    super(type, init);
    this.detail = init?.detail as T;
  }
}

describe('profile cached username helpers', () => {
  const setItem = vi.fn();
  const getItem = vi.fn();
  const removeItem = vi.fn();

  beforeEach(() => {
    setItem.mockReset();
    getItem.mockReset();
    removeItem.mockReset();
    vi.stubGlobal('localStorage', { setItem, getItem, removeItem });
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('CustomEvent', TestCustomEvent as unknown as typeof CustomEvent);
    clearCurrentUsername();
    setAuthChecking(true);
    clearAuthUser();
  });

  it('returns null when no cached username is present', () => {
    getItem.mockReturnValueOnce(null);
    expect(getCachedUsername()).toBeNull();
  });

  it('returns the stored cached username after trimming', () => {
    setCurrentUsername('demo-blog');
    getItem.mockReturnValueOnce('demo-blog');
    expect(getCachedUsername()).toBe('demo-blog');
  });
});

describe('resolvePostAuthMode', () => {
  it('returns unknown while auth bootstrap is still running', () => {
    expect(resolvePostAuthMode({ checkingAuth: true, authUser: null })).toBe('unknown');
  });

  it('returns authenticated when auth bootstrap is complete and auth user exists', () => {
    expect(resolvePostAuthMode({ checkingAuth: false, authUser: { userId: 1 } as any })).toBe('authenticated');
  });

  it('returns anonymous when auth bootstrap is complete and auth user is absent', () => {
    expect(resolvePostAuthMode({ checkingAuth: false, authUser: null })).toBe('anonymous');
  });
});

describe('shared auth state', () => {
  it('tracks checkingAuth independently from anonymous and authenticated user state', () => {
    expect(isAuthCheckPending()).toBe(false);
    expect(getAuthState()).toEqual({ checkingAuth: false, authUser: null });

    setAuthChecking(true);
    expect(isAuthCheckPending()).toBe(true);
    expect(getAuthState()).toEqual({ checkingAuth: true, authUser: null });

    setAuthUser({ userId: 1, blogId: 2 } as any);
    expect(isAuthCheckPending()).toBe(false);
    expect(getAuthState()).toEqual({
      checkingAuth: false,
      authUser: { userId: 1, blogId: 2 },
    });

    setAuthChecking(true);
    clearAuthUser();
    expect(isAuthCheckPending()).toBe(false);
    expect(getAuthState()).toEqual({ checkingAuth: false, authUser: null });
  });
});

describe('view-post auth bootstrap contract', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('reads checkingAuth from shared auth state instead of a microtask approximation', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/view-post.ts'), 'utf8');

    expect(src).toContain("import { getAuthUser, isAuthCheckPending } from '../state/auth-state.js';");
    expect(src).toContain('checkingAuth: isAuthCheckPending(),');
    expect(src).not.toContain('queueMicrotask');
    expect(src).not.toContain('authBootstrapComplete');
  });

  it('keeps shared-nav logged out when only cached username memory exists', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
    });
    vi.spyOn(blogMeta, 'fetchHydratedBlogMetaByName').mockResolvedValue(null);
    setCurrentUsername('demo-blog');
    clearAuthUser();

    const el = document.createElement('shared-nav') as any;
    document.body.appendChild(el);

    await el.updateComplete;
    await Promise.resolve();
    await el.updateComplete;

    expect(getCachedUsername()).toBe('demo-blog');
    expect(el.currentUsername).toBeNull();

    const toggle = el.shadowRoot?.querySelector('.profile-toggle') as HTMLButtonElement | null;
    expect(toggle?.getAttribute('aria-label')).toBe('Log in');
    expect(toggle?.textContent?.trim()).toBe('Log in');

    el.menuOpen = true;
    el.requestUpdate();
    await el.updateComplete;

    const menuText = el.shadowRoot?.querySelector('.profile-menu')?.textContent || '';
    expect(menuText).toContain('Log in');
    expect(menuText).not.toContain('Log out');
  });
});
