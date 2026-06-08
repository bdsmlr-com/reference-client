import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post detail performance guards', () => {
  it('gives get-post-detail an explicit elevated timeout budget', () => {
    const src = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');

    expect(src).toContain("'/v2/get-post-detail': 30000");
  });

  it('shares micro blog identity hydration through the shared blog-meta cache service', () => {
    const identitySrc = readFileSync(join(ROOT, 'components/blog-identity.ts'), 'utf8');
    const metaSrc = readFileSync(join(ROOT, 'services/blog-meta.ts'), 'utf8');

    expect(identitySrc).toContain("from '../services/blog-meta.js'");
    expect(identitySrc).toContain('fetchHydratedBlogMetaById(this.blogId)');
    expect(metaSrc).toContain('const hydratedBlogMetaByIdCache = new Map<number');
    expect(metaSrc).toContain('const hydratedBlogMetaByNameCache = new Map<string');
    expect(metaSrc).toContain('const hydratedBlogMetaByIdInflight = new Map<number');
    expect(metaSrc).toContain('const hydratedBlogMetaByNameInflight = new Map<string');
  });
});
