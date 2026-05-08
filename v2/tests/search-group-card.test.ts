import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/search-group-card.ts');

describe('search group card', () => {
  it('navigates grouped cards to the origin post page instead of a search drilldown', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("window.location.href = `/post/${this.originPostId}`;");
    expect(src).not.toContain('search-group-click');
    expect(src).not.toContain('q=post:');
  });

  it('shows the archive blog reblog date only in archive context', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("@property({ type: String }) page: 'archive' | 'search' | 'post' | 'activity' | 'feed' | 'social' = 'search';");
    expect(src).toContain("const archiveReblogDate = this.page === 'archive' ? formatDate(this.post.createdAtUnix, 'date') : '';");
    expect(src).toContain("import './blog-identity.js';");
    expect(src).toContain('class="archive-origin-line"');
    expect(src).toContain('<blog-identity');
    expect(src).toContain('.showAvatar=${false}');
    expect(src).toContain("${archiveReblogDate ? html`<div class=\"archive-reblog-date\">${archiveReblogDate}</div>` : ''}");
    expect(src).toContain('<div class="stats-line">');
  });
});
