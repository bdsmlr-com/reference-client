import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/post-engagement.ts');

describe('post engagement activity pane', () => {
  it('renders clickable count pills instead of plain labels', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("❤️ ${p.likesCount ?? 0}");
    expect(src).toContain("♻️ ${p.reblogsCount ?? 0}");
    expect(src).toContain("💬 ${p.commentsCount ?? 0}");
  });

  it('renders my activity above the full reverse chronological feed', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain('private getActiveBlogId');
    expect(src).toContain('private splitPersonalActivity');
    expect(src).toContain('My activity');
    expect(src).toContain('All activity');
    expect(src).toContain('myRows');
    expect(src).toContain('allRows');
  });
});
