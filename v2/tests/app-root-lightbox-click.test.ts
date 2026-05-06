import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('app-root post navigation', () => {
  it('routes post-click events into /post URLs with explicit provenance', () => {
    const src = readFileSync(join(process.cwd(), 'src/app-root.ts'), 'utf8');

    expect(src).toContain("import { buildPostHref } from './services/post-route-context.js';");
    expect(src).toContain("const from = e.detail?.from || 'direct';");
    expect(src).toContain('window.location.assign(buildPostHref(post.id, from));');
    expect(src).not.toContain("import './components/post-lightbox.js';");
    expect(src).not.toContain('@state() private lightboxOpen');
    expect(src).not.toContain('<post-lightbox');
  });
});
