import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post detail performance guards', () => {
  it('gives get-post-detail an explicit elevated timeout budget', () => {
    const src = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');

    expect(src).toContain("'/v2/get-post-detail': 30000");
  });

  it('shares micro blog identity hydration across instances and negative results', () => {
    const src = readFileSync(join(ROOT, 'components/blog-identity.ts'), 'utf8');

    expect(src).toContain('const hydratedBlogMetaCache = new Map<number');
    expect(src).toContain('const hydratedBlogMetaInflight = new Map<number');
    expect(src).toContain('async function fetchHydratedBlogMeta(blogId: number)');
    expect(src).toContain('setHydratedBlogMeta(blogId, null);');
    expect(src).toContain('const blog = await fetchHydratedBlogMeta(this.blogId);');
  });
});
