import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/shared-nav.ts');
const setInfiniteScrollPreference = vi.fn();

vi.mock('lit', () => ({
  LitElement: class LitElement {},
  html: (strings: TemplateStringsArray | readonly string[], ...values: unknown[]) => ({ strings, values }),
  css: (strings: TemplateStringsArray | readonly string[], ...values: unknown[]) => ({ strings, values }),
  unsafeCSS: (value: unknown) => String(value),
}));

vi.mock('lit/decorators.js', () => ({
  customElement: () => (value: unknown) => value,
  property: () => () => undefined,
  state: () => () => undefined,
}));

vi.mock('../src/services/profile.js', () => ({
  getCurrentUsername: () => null,
  isLoggedIn: () => false,
  clearCurrentUsername: vi.fn(),
  setCurrentUsername: vi.fn(),
  getGalleryMode: () => 'grid',
  setGalleryMode: vi.fn(),
  PROFILE_EVENTS: {},
  getArchiveSortPreference: () => 'new',
  setArchiveSortPreference: vi.fn(),
  getSearchSortPreference: () => 'new',
  setSearchSortPreference: vi.fn(),
}));

vi.mock('../src/services/storage.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/storage.js')>();
  return {
    ...actual,
    getInfiniteScrollPreference: () => false,
    setInfiniteScrollPreference,
  };
});

vi.mock('../src/components/blog-identity.js', () => ({}));

class HTMLElementStub {}
const storageMap = new Map<string, string>();

const localStorageStub = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageMap.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => {
    storageMap.clear();
  },
};

Object.assign(globalThis, {
  HTMLElement: HTMLElementStub,
  localStorage: localStorageStub,
  window: {
    location: { origin: 'http://localhost', pathname: '/' },
    matchMedia: () => ({ matches: false }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  },
  document: {
    activeElement: null,
    documentElement: { setAttribute: vi.fn() },
    createElement: vi.fn(() => ({ id: '', textContent: '' })),
    getElementById: vi.fn(() => null),
    head: { appendChild: vi.fn() },
  },
  customElements: {
    define: vi.fn(),
    get: vi.fn(),
  },
});

type LitTemplateLike = {
  strings?: TemplateStringsArray | readonly string[];
  values?: unknown[];
};

function flattenTemplate(value: unknown): string {
  if (value == null || value === false) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(flattenTemplate).join('');
  }
  if (typeof value === 'object' && value && 'strings' in value && 'values' in value) {
    const template = value as LitTemplateLike;
    const strings = [...(template.strings ?? [])];
    const values = template.values ?? [];
    let out = '';
    for (let i = 0; i < strings.length; i += 1) {
      out += strings[i] ?? '';
      if (i < values.length) {
        out += flattenTemplate(values[i]);
      }
    }
    return out;
  }
  return '';
}

const { SharedNav } = await import('../src/components/shared-nav.js');

describe('shared nav preferences', () => {
  beforeEach(() => {
    setInfiniteScrollPreference.mockReset();
  });

  it('surfaces a global infinite scroll preference in the profile menu', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('Infinite scroll');
    expect(src).toContain('setInfiniteScrollPreference');
  });

  it('renders the infinite scroll checkbox in the logged-out settings menu path', () => {
    const nav = Object.assign(Object.create(SharedNav.prototype), {
      infiniteScrollPref: false,
      getClearCacheUrl: () => '/cache/clear',
      openLoginModal: vi.fn(),
      renderInfiniteScrollPreference: SharedNav.prototype['renderInfiniteScrollPreference'],
    });

    const template = SharedNav.prototype['renderProfileMenu'].call(nav);
    const output = flattenTemplate(template);

    expect(output).toContain('Settings');
    expect(output).toContain('Infinite scroll');
    expect(output).toContain('type="checkbox"');
    expect(output).toContain('Log in');
    expect(output).toContain('Clear cache');
  });

  it('updates local state and persists the infinite scroll preference when toggled', () => {
    const nav = { infiniteScrollPref: false };
    const event = {
      target: { checked: true },
    } as Event;

    SharedNav.prototype['handleInfiniteScrollPreferenceChange'].call(nav, event);

    expect(setInfiniteScrollPreference).toHaveBeenCalledWith(true);
    expect(nav.infiniteScrollPref).toBe(true);
  });
});
