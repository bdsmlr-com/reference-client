import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('activity route alias', () => {
  it('app router uses only /:blog/activity', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(appRootSrc).toContain("{ path: '/:blog/activity'");
    expect(appRootSrc).not.toContain("{ path: '/:blog/posts'");
  });

  it('shared nav targets activity path for the activity tab', () => {
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');

    expect(navSrc).toContain("if (page === 'posts')");
    expect(navSrc).toContain("return buildPageUrl('activity', blogName);");
  });

  it('activity view honors sort from URL and passes sort_field to API', () => {
    const postsSrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(postsSrc).toContain("const sort = getUrlParam('sort');");
    expect(postsSrc).toContain('this.sortValue = normalizeSortValue(sort);');
    expect(postsSrc).toContain('sort_field: sortOption.field');
    expect(postsSrc).toContain('.showSort=${true}');
  });
});
