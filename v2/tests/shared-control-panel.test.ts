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
    expect(src).toContain('<archive-when-picker');
    expect(src).toContain('<variant-pills');
    expect(src).toContain('<activity-kind-pills');
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

    expect(activitySrc).toContain('.showActivityKinds=${true}');
    expect(activitySrc).toContain('.showTypes=${true}');

    expect(archiveSrc).toContain('.showSort=${true}');
    expect(archiveSrc).toContain('.showVariants=${true}');
    expect(archiveSrc).toContain('.showWhen=${true}');

    expect(searchSrc).toContain('.showSort=${true}');
    expect(searchSrc).toContain('.showVariants=${true}');
    expect(searchSrc).toContain('.showWhen=${true}');
  });
});
