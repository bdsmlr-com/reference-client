import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('archive when picker', () => {
  it('renders a compact breadcrumbed archive picker and emits when-change events', () => {
    const src = readFileSync(join(ROOT, 'components/archive-when-picker.ts'), 'utf8');

    expect(src).toContain("@customElement('archive-when-picker')");
    expect(src).toContain('All time');
    expect(src).toContain('breadcrumbs');
    expect(src).toContain('resolveArchiveWhenBounds');
    expect(src).toContain('getArchiveWhenYears');
    expect(src).toContain('getArchiveWhenMonths');
    expect(src).toContain('getArchiveWhenDays');
    expect(src).toContain("EventNames.WHEN_CHANGE");
    expect(src).toContain("detail: { value }");
    expect(src).toContain('aria-haspopup="dialog"');
    expect(src).toContain('<strong>${formatArchiveWhenLabel(this.value)}</strong>');
  });
});
