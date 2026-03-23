import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

describe('cruft cleanup guardrails', () => {
  it('does not keep orphaned activity page implementation', () => {
    expect(existsSync(join(ROOT, 'src/pages/view-activity.ts'))).toBe(false);
  });

  it('does not keep ad hoc root-level test scripts', () => {
    expect(existsSync(join(ROOT, 'test-gif-logic.js'))).toBe(false);
    expect(existsSync(join(ROOT, 'test-resolver.js'))).toBe(false);
  });

  it('app-root does not import deprecated activity page', () => {
    const appRootSrc = readFileSync(join(ROOT, 'src/app-root.ts'), 'utf8');
    expect(appRootSrc).not.toContain("import './pages/view-activity.js';");
  });

  it('api client does not keep deprecated followers/following wrappers', () => {
    const apiSrc = readFileSync(join(ROOT, 'src/services/api.ts'), 'utf8');
    expect(apiSrc).not.toContain('async listFollowers(');
    expect(apiSrc).not.toContain('async listFollowing(');
    expect(apiSrc).not.toContain('export async function listBlogFollowers(');
    expect(apiSrc).not.toContain('export async function listBlogFollowing(');
    expect(apiSrc).not.toContain('TECH-010f: Remove legacy function exports');
  });

  it('timeline stream does not keep unreachable legacy-cluster rendering path', () => {
    const streamSrc = readFileSync(join(ROOT, 'src/components/timeline-stream.ts'), 'utf8');
    expect(streamSrc).not.toContain('legacy-cluster');
  });
});
