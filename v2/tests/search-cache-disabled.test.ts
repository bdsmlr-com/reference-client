import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/services/api.ts');

describe('tag search caching is disabled', () => {
  it('does not use browser search cache helpers for post tag search', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).not.toContain('generateSearchCacheKey,');
    expect(src).not.toContain('getCachedSearchResult,');
    expect(src).not.toContain('setCachedSearchResult,');
    expect(src).not.toContain('const cacheKey = `search:${BUILD_SHA}:${generateSearchCacheKey(req as unknown as Record<string, unknown>)}`;');
    expect(src).not.toContain('const cached = getCachedSearchResult<SearchPostsByTagResponse>(cacheKey);');
    expect(src).not.toContain('setCachedSearchResult(cacheKey, response);');
  });
});
