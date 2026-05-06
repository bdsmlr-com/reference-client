import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('blog context cleanup', () => {
  it('keeps blog-context as a minimal non-editable strip', () => {
    const src = readFileSync(join(ROOT, 'components/blog-context.ts'), 'utf8');

    expect(src).toContain("@customElement('blog-context')");
    expect(src).toContain('class="context-container"');
    expect(src).toContain('Blog');
    expect(src).toContain('@${this.viewedBlog}');
    expect(src).not.toContain('edit-container');
    expect(src).not.toContain('blog-input');
    expect(src).not.toContain('click to change');
    expect(src).not.toContain('Back to @');
  });
});
