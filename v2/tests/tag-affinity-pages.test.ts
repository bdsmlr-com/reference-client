import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('tag affinity page wiring', () => {
  it('search wires an interactive affinity cloud for the active blog perspective', () => {
    const src = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(src).toContain("import '../components/affinity-tag-cloud.js';");
    expect(src).toContain("@state() private searchAffinityInteraction: 'both' | 'likes' | 'reblogs' = 'both';");
    expect(src).toContain("@state() private searchAffinityHorizon: 'recent' | 'all' = 'recent';");
    expect(src).toContain("const subjectBlog = getBlogNameFromPath() || getPrimaryBlogName() || '';");
    expect(src).toContain('await this.loadSearchAffinity();');
    expect(src).toContain('<affinity-tag-cloud');
    expect(src).toContain('.showControls=${true}');
    expect(src).toContain('.interactionMode=${this.searchAffinityInteraction}');
    expect(src).toContain('.horizon=${this.searchAffinityHorizon}');
    expect(src).toContain('@tag-select=${this.handleSearchAffinityTagSelect}');
  });

  it('archive keeps native top tags primary and adds a separate all-time affinity panel', () => {
    const src = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(src).toContain("import '../components/affinity-tag-cloud.js';");
    expect(src).toContain("@state() private archiveAffinityError = '';");
    expect(src).toContain('void this.loadArchiveAffinityCloud();');
    expect(src).toContain('<archive-tag-cloud');
    expect(src).toContain('<affinity-tag-cloud');
    expect(src).toContain(".title=${'Affinity Tags'}");
    expect(src).toContain(".interactionMode=${'both'}");
    expect(src).toContain(".horizon=${'all'}");
  });

  it('blog renders a compact recent-both affinity panel that navigates into profiled search', () => {
    const src = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');

    expect(src).toContain("import '../components/affinity-tag-cloud.js';");
    expect(src).toContain("@state() private blogAffinityError = '';");
    expect(src).toContain('await this.loadBlogAffinityCloud();');
    expect(src).toContain('<affinity-tag-cloud');
    expect(src).toContain(".title=${'Recently Into'}");
    expect(src).toContain(".interactionMode=${'both'}");
    expect(src).toContain(".horizon=${'recent'}");
    expect(src).toContain("buildPageUrl('search', this.blog, { q: nextQuery })");
  });
});
