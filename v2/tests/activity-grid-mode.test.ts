import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toPresentationModel } from '../src/services/post-presentation';

const ROOT = join(process.cwd(), 'src');

describe('gallery mode wiring', () => {
  it('maps posts into presentation model with permalink action', () => {
    const model = toPresentationModel(
      { id: 42, blogName: 'demo', type: 2 } as any,
      { view: 'archive' },
    );

    expect(model.showPermalink).toBe(true);
    expect(model.actions.some((a) => a.kind === 'permalink')).toBe(true);
    expect(model.linkContexts.permalink).toBe('post_permalink');
  });

  it('media config contains layered post render policy blocks', () => {
    const mediaConfigPath = join(process.cwd(), 'media-config.json');
    const mediaConfig = JSON.parse(readFileSync(mediaConfigPath, 'utf8'));
    const policy = mediaConfig.post_render_policy;

    expect(policy).toBeDefined();
    expect(policy.base).toBeDefined();
    expect(policy.by_view).toBeDefined();
    expect(policy.by_role).toBeDefined();
    expect(policy.by_env).toBeDefined();
  });

  it('activity-grid supports explicit grid/masonry mode', () => {
    const src = readFileSync(join(ROOT, 'components/activity-grid.ts'), 'utf8');

    expect(src).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(src).toContain("@property({ type: String, reflect: true }) mode: 'grid' | 'masonry' = 'grid';");
    expect(src).toContain(":host([mode='masonry'])");
    expect(src).toContain("const presentation = toPresentationModel(p, { surface: 'card', page: 'activity', interactionKind: this.interactionType, role: 'cluster' });");
    expect(src).toContain('let typeIcon = presentation.identity.postTypeIcon || \'📄\'');
    expect(src).not.toContain('POST_TYPE_ICONS[p.type as PostType] ||');
  });

  it('uses stable row-first column assignment for masonry pagination', () => {
    const src = readFileSync(join(ROOT, 'components/activity-grid.ts'), 'utf8');

    expect(src).toContain('const colCount = this.compact ? 4 : this.getMasonryColumnCount();');
    expect(src).toContain('columns[i % colCount].push(item);');
    expect(src).not.toContain(":host([mode='masonry']) {\n        display: block;\n        columns:");
  });

  it('archive and search views pass persisted gallery mode into activity-grid', () => {
    const archiveSrc = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(archiveSrc).toContain('.mode=${this.galleryMode}');
    expect(searchSrc).toContain('.mode=${this.galleryMode}');
    expect(archiveSrc).toContain("getGalleryMode()")
    expect(searchSrc).toContain("getGalleryMode()")
  });

  it('activity cards use origin-aware blog chip logic for like/comment/reblog interactions', () => {
    const src = readFileSync(join(ROOT, 'components/activity-grid.ts'), 'utf8');

    expect(src).toContain('const chipBlogName = presentation.identity.chipBlogLabel;');
    expect(src).toContain('white-space: nowrap;');
    expect(src).toContain('text-overflow: ellipsis;');
    expect(src).not.toContain('reblog-variant-badge');
  });
});
