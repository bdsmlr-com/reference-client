import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('search route perspective wiring', () => {
  it('threads the route blog perspective into the search request payload', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain("import { getBlogNameFromPath, getUrlParam, setUrlParams, isDefaultTypes } from '../services/blog-resolver.js';");
    expect(src).toContain('perspective_blog_name');
    expect(src).toContain('const routePerspectiveBlog = getBlogNameFromPath();');
    expect(src).toContain('perspective_blog_name: routePerspectiveBlog || undefined');
    expect(src).toContain('tag_name: this.query');
  });
});
