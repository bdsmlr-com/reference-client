import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('retrieval response typing', () => {
  it('accepts canonical retrieval fields for search-like surfaces', () => {
    const scratchDir = mkdtempSync(join(process.cwd(), 'tests', '.retrieval-response-'));
    const entryFile = join(scratchDir, 'check.ts');
    const tscBin = join(process.cwd(), 'node_modules', '.bin', 'tsc');

    writeFileSync(
      entryFile,
      [
        "import type { SearchPostsByTagResponse } from '../../src/types/api.js';",
        '',
        'const response: SearchPostsByTagResponse = {',
        '  posts: [],',
        "  page: { nextPageToken: 'abc' },",
        '  policy: {',
        '    defaultResultWindowLimit: 100,',
        '    clearResultCount: 10,',
        "    ditherStrategy: 'origin_blog_post_keyed_sha256',",
        "    imageVariants: ['feed', 'feed-pixelated', 'feed-pixelated-animated'],",
        '    capabilities: [],',
        '  },',
        '  postPolicies: {},',
        '};',
        '',
        'void response.page?.nextPageToken;',
        '',
      ].join('\n'),
      'utf8',
    );

    try {
      expect(() =>
        execFileSync(
          tscBin,
          [
            '--noEmit',
            '--pretty',
            'false',
            '--target',
            'ES2020',
            '--module',
            'ESNext',
            '--moduleResolution',
            'bundler',
            '--strict',
            '--skipLibCheck',
            entryFile,
          ],
          { cwd: process.cwd(), stdio: 'pipe' },
        ),
      ).not.toThrow();
    } finally {
      rmSync(scratchDir, { recursive: true, force: true });
    }
  });
});
