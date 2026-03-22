import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('app-root lightbox click normalization', () => {
  it('normalizes post-click payload when posts/index are missing', () => {
    const src = readFileSync(join(process.cwd(), 'src/app-root.ts'), 'utf8');
    expect(src).toContain('const safePosts = Array.isArray(posts) && posts.length > 0 ? posts : (safePost ? [safePost] : []);');
    expect(src).toContain('const safeIndex = Number.isFinite(index) ? index : 0;');
  });
});
