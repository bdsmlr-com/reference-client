import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FILE = join(process.cwd(), 'src/components/blog-header.ts');

describe('blog-header action menu', () => {
  it('replaces the inline follow pill with an activity-page ellipsis menu backed by follow and block state', () => {
    const src = readFileSync(FILE, 'utf8');
    expect(src).toContain("import { blockedStateController } from '../services/blocked-state.js';");
    expect(src).toContain("import { reportBlog } from '../services/api.js';");
    expect(src).toContain("this.page === 'activity'");
    expect(src).toContain('class="menu-trigger"');
    expect(src).toContain('Follow');
    expect(src).toContain('Block');
    expect(src).toContain('Report blog');
  });
});
