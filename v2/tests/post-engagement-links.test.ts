import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/post-engagement.ts');

describe('post engagement links', () => {
  it('guards empty blog names and falls back to @unknown text', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('private normalizeBlogName');
    expect(src).toContain('private renderBlogIdentity');
    expect(src).toContain("const normalized = (blogName || '').trim();");
    expect(src).toContain("const label = normalized ? `@${normalized}` : '@unknown';");
    expect(src).not.toContain('href="/${p.originBlogName}/posts"');
    expect(src).not.toContain('href="/${p.blogName}/posts"');
  });
});
