import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/pages/view-archive.ts');

describe('archive route API integration', () => {
  it('uses the archive posts API instead of the tag search API', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('apiClient.posts.list({');
    expect(src).toContain("activity_kinds: ['post', 'reblog']");
    expect(src).not.toContain('apiClient.posts.searchCached({');
  });
});
