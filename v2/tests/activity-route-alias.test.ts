import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('activity route alias', () => {
  it('app router supports both /:blog/activity and /:blog/posts', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(appRootSrc).toContain("{ path: '/:blog/activity'");
    expect(appRootSrc).toContain("{ path: '/:blog/posts'");
  });

  it('shared nav targets activity path for the activity tab', () => {
    const navSrc = readFileSync(join(ROOT, 'components/shared-nav.ts'), 'utf8');

    expect(navSrc).toContain("if (page === 'posts')");
    expect(navSrc).toContain("return buildPageUrl('activity', blogName);");
  });
});
