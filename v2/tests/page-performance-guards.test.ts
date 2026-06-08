import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('page performance guards', () => {
  it('gives heavy archive and recommendation endpoints explicit timeout budgets', () => {
    const src = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');

    expect(src).toContain("'/v2/list-blog-activity': 30000");
    expect(src).toContain("'/v2/list-blog-top-tags': 30000");
    expect(src).toContain("'/v2/list-recommended-blogs': 30000");
  });

  it('does not block social followers/following pages on recommended-blog hydration', () => {
    const src = readFileSync(join(ROOT, 'pages/view-social.ts'), 'utf8');

    expect(src).not.toContain('await Promise.all([this.fetchPage(), this.loadRecommendedBlogs()]);');
    expect(src).toContain('await this.fetchPage();');
    expect(src).toContain('void this.loadRecommendedBlogs();');
    expect(src).toContain('private recommendedBlogsLoadedFor =');
    expect(src).toContain('private recommendedBlogsPromise: Promise<void> | null = null;');
  });

  it('does not block feed rendering on interaction-cluster enrichment', () => {
    const src = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');

    expect(src).toContain('private clusterLoadGeneration = 0;');
    expect(src).toContain('void this.fetchAndAppendInteractionClusters(activeBlogIds.slice(0, MAX_CLUSTER_FETCH_BLOGS), clusterGeneration);');
    expect(src).toContain('private async fetchAndAppendInteractionClusters(blogIds: number[], generation: number): Promise<void>');
  });
});
