import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('retrieval response typing', () => {
  it('reports the missing retrieval contract fields in the handwritten client types', () => {
    const scratchDir = mkdtempSync(join(process.cwd(), 'tests', '.retrieval-response-'));
    const entryFile = join(scratchDir, 'check.ts');
    const tscBin = join(process.cwd(), 'node_modules', '.bin', 'tsc');

    writeFileSync(
      entryFile,
      [
        "import type { SearchPostsByTagResponse } from '../../src/types/api.js';",
        '',
        'const responseWithPolicy: SearchPostsByTagResponse = {',
        '  posts: [],',
        "  page: { nextPageToken: 'abc' },",
        '  policy: {',
        '    defaultResultWindowLimit: 100,',
        '    clearResultCount: 10,',
        "    ditherStrategy: 'origin_blog_post_keyed_sha256',",
        "    imageVariants: ['feed', 'feed-pixelated', 'feed-pixelated-animated'],",
        '    capabilities: [],',
        '  },',
        '};',
        '',
        'const responseWithPostPolicies: SearchPostsByTagResponse = {',
        '  posts: [],',
        "  page: { nextPageToken: 'abc' },",
        '  postPolicies: {},',
        '};',
        '',
        'void responseWithPolicy.page?.nextPageToken;',
        'void responseWithPostPolicies.page?.nextPageToken;',
        '',
      ].join('\n'),
      'utf8',
    );

    const result = spawnSync(
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
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    try {
      expect(result.status).not.toBe(0);
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      expect(output).toContain('Object literal may only specify known properties');
      expect(output).toContain("'policy' does not exist");
      expect(output).toContain("'postPolicies' does not exist");
      expect(output).toContain('SearchPostsByTagResponse');
    } finally {
      rmSync(scratchDir, { recursive: true, force: true });
    }
  });
});
