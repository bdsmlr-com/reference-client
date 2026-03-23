import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('QA regressions: feed/nav/archive/lightbox', () => {
  it('adds click fallback for feed post cards in timeline stream', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/timeline-stream.ts'), 'utf8');
    expect(src).toContain('@click=${() => this.handlePostClick(item.post)}');
  });

  it('consolidates feed activity chips by removing legacy filter bar row', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/view-feed.ts'), 'utf8');
    expect(src).not.toContain('<filter-bar');
  });

  it('consolidates blog activity chips into a single row by removing filter-bar from activity page', () => {
    const src = readFileSync(join(process.cwd(), 'src/pages/view-posts.ts'), 'utf8');
    expect(src).not.toContain('<filter-bar');
    expect(src).toContain('<activity-kind-pills');
  });

  it('uses viewed blog fallback for Activity nav route', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/shared-nav.ts'), 'utf8');
    expect(src).toContain('const viewedBlog = getViewedBlogName();');
    expect(src).toContain('const blogName = primaryBlog || viewedBlog;');
  });

  it('scrolls to top when clicking current nav tab', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/shared-nav.ts'), 'utf8');
    expect(src).toContain('window.scrollTo({ top: 0, behavior:');
  });

  it('supports suppressing archive blog chip on activity-item', () => {
    const itemSrc = readFileSync(join(process.cwd(), 'src/components/activity-grid.ts'), 'utf8');
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');
    expect(itemSrc).toContain('@property({ type: Boolean }) showBlogChip = true;');
    expect(archiveSrc).toContain('.showBlogChip=${false}');
  });

  it('does not force archive/search cluster items into like cards', () => {
    const archiveSrc = readFileSync(join(process.cwd(), 'src/pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(process.cwd(), 'src/pages/view-search.ts'), 'utf8');
    expect(archiveSrc).not.toContain("type: 'like'");
    expect(searchSrc).not.toContain("type: 'like'");
  });

  it('renders recommendation metadata in post recommendations cards', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-recommendations.ts'), 'utf8');
    expect(src).toContain('class="rec-meta"');
  });

  it('falls back to per-post hydration when recommendation batch-get fails', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/post-recommendations.ts'), 'utf8');
    expect(src).toContain('Promise.allSettled');
    expect(src).toContain('await apiClient.posts.get(postId)');
  });
});
