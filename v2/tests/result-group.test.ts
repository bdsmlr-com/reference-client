import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('result-group component', () => {
  it('provides a reusable grouped-results shell with header and load-more affordance', () => {
    const src = readFileSync(join(ROOT, 'components/result-group.ts'), 'utf8');

    expect(src).toContain("@customElement('result-group')");
    expect(src).toContain("@property({ type: String }) label = '';");
    expect(src).toContain("@property({ type: String }) title = '';");
    expect(src).toContain("@property({ type: String }) description = '';");
    expect(src).toContain("@property({ type: String }) actionHref = '';");
    expect(src).toContain("@property({ type: Number }) remaining = 0;");
    expect(src).toContain("@property({ type: String }) actionLabel = 'Load more';");
    expect(src).toContain("@property({ type: Boolean, reflect: true }) wide = false;");
    expect(src).toContain("@property({ type: Boolean, reflect: true }) bare = false;");
    expect(src).toContain(':host([bare])');
    expect(src).toContain("<slot></slot>");
    expect(src).toContain("this.dispatchEvent(new CustomEvent('result-group-load-more'");
    expect(src).toContain('class="action-link"');
    expect(src).toContain('${this.actionLabel} (${this.remaining})');
  });
});
