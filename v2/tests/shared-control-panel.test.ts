import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('shared control panel', () => {
  it('defines a shared compact control-panel component with inline separators and optional sections', () => {
    const src = readFileSync(join(ROOT, 'components/control-panel.ts'), 'utf8');

    expect(src).toContain("@customElement('control-panel')");
    expect(src).toContain("import './activity-kind-pills.js';");
    expect(src).toContain("import './archive-when-picker.js';");
    expect(src).toContain("import './gallery-mode-picker.js';");
    expect(src).toContain("import './infinite-scroll-toggle.js';");
    expect(src).toContain("import './sort-controls.js';");
    expect(src).toContain("import './type-pills.js';");
    expect(src).toContain("import './variant-pills.js';");
    expect(src).toContain('.control-row');
    expect(src).toContain('.separator');
    expect(src).toContain('showSort');
    expect(src).toContain('showWhen');
    expect(src).toContain('showActivityKinds');
    expect(src).toContain('showTypes');
    expect(src).toContain('showVariants');
    expect(src).toContain('showGalleryMode');
    expect(src).toContain('showInfiniteScroll');
    expect(src).toContain('<archive-when-picker');
    expect(src).toContain('<variant-pills');
    expect(src).toContain('<activity-kind-pills');
    expect(src).toContain('<gallery-mode-picker');
    expect(src).toContain('<infinite-scroll-toggle');
  });

  it('routes feed, activity, archive, and search through the shared control-panel component', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');
    const activitySrc = readFileSync(join(ROOT, 'pages/view-posts.ts'), 'utf8');
    const archiveSrc = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');
    const searchSrc = readFileSync(join(ROOT, 'pages/view-search.ts'), 'utf8');

    expect(feedSrc).toContain("import '../components/control-panel.js';");
    expect(activitySrc).toContain("import '../components/control-panel.js';");
    expect(archiveSrc).toContain("import '../components/control-panel.js';");
    expect(searchSrc).toContain("import '../components/control-panel.js';");

    expect(feedSrc).toContain('<control-panel');
    expect(activitySrc).toContain('<control-panel');
    expect(archiveSrc).toContain('<control-panel');
    expect(searchSrc).toContain('<control-panel');

    expect(feedSrc).toContain('.showActivityKinds=${true}');
    expect(feedSrc).toContain('.showTypes=${true}');
    expect(feedSrc).toContain('.showSort=${false}');
    expect(feedSrc).toContain('.showWhen=${false}');
    expect(feedSrc).toContain('.showInfiniteScroll=${true}');

    expect(activitySrc).toContain('.showActivityKinds=${true}');
    expect(activitySrc).toContain('.showTypes=${true}');
    expect(activitySrc).toContain('.showInfiniteScroll=${true}');

    expect(archiveSrc).toContain('.showSort=${true}');
    expect(archiveSrc).toContain('.showVariants=${true}');
    expect(archiveSrc).toContain('.showWhen=${true}');
    expect(archiveSrc).toContain('.showGalleryMode=${true}');
    expect(archiveSrc).toContain('.showInfiniteScroll=${true}');

    expect(searchSrc).toContain('.showSort=${true}');
    expect(searchSrc).toContain('.showVariants=${true}');
    expect(searchSrc).toContain('.showWhen=${true}');
    expect(searchSrc).toContain('.showGalleryMode=${true}');
    expect(searchSrc).toContain('.showInfiniteScroll=${true}');
  });

  it('uses compact popover selectors for shared type and variant filters', () => {
    const typeSrc = readFileSync(join(ROOT, 'components/type-pills.ts'), 'utf8');
    const variantSrc = readFileSync(join(ROOT, 'components/variant-pills.ts'), 'utf8');
    const gallerySrc = readFileSync(join(ROOT, 'components/gallery-mode-picker.ts'), 'utf8');
    const activityKindSrc = readFileSync(join(ROOT, 'components/activity-kind-pills.ts'), 'utf8');

    expect(typeSrc).toContain('All media');
    expect(typeSrc).toContain("import { customElement, property, state } from 'lit/decorators.js';");
    expect(typeSrc).toContain('@state() private open = false;');
    expect(typeSrc).toContain('selectedTypeSummary');
    expect(typeSrc).toContain('aria-haspopup="dialog"');
    expect(typeSrc).toContain('role="dialog"');

    expect(variantSrc).toContain('All posts');
    expect(variantSrc).toContain("import { customElement, property, state } from 'lit/decorators.js';");
    expect(variantSrc).toContain('@state() private open = false;');
    expect(variantSrc).toContain('Original posts');
    expect(variantSrc).toContain('Reblogged posts');
    expect(variantSrc).toContain('aria-haspopup="dialog"');
    expect(variantSrc).toContain('role="dialog"');

    expect(gallerySrc).toContain("import { customElement, property, state } from 'lit/decorators.js';");
    expect(gallerySrc).toContain('@state() private open = false;');
    expect(activityKindSrc).toContain("import { customElement, property, state } from 'lit/decorators.js';");
    expect(activityKindSrc).toContain('@state() private open = false;');
  });
});
