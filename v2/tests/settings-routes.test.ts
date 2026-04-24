import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('settings routes', () => {
  it('recognizes /settings/user/:username and /settings/blog/:blogName', () => {
    const appRootSrc = readFileSync(join(ROOT, 'app-root.ts'), 'utf8');

    expect(appRootSrc).toContain("{ path: '/settings/user/:username'");
    expect(appRootSrc).toContain("{ path: '/settings/blog/:blogName'");
    expect(appRootSrc).toContain('view-settings-user');
    expect(appRootSrc).toContain('view-settings-blog');
  });
});
