import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('archive pagination mode', () => {
  it('forces paginated mode when explicit archive page, cursor, or when state is present', () => {
    const src = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(src).toContain("private navigationMode: 'infinite' | 'paginated' = 'infinite'");
    expect(src).toContain("getUrlParam('page')");
    expect(src).toContain("getUrlParam('cursor')");
    expect(src).toContain("getUrlParam('when')");
    expect(src).toContain("'paginated'");
  });

  it('honors explicit archive page state even when no cursor is present', () => {
    const src = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(src).toContain('const explicitPage = parseArchivePageParam(getUrlParam(\'page\'))');
    expect(src).toContain('this.currentPage = explicitPage ?? 1;');
  });

  it('threads paginated archive mode into the shared footer controls', () => {
    const src = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(src).toContain('.navigationMode=${this.navigationMode}');
    expect(src).toContain('@previous-page=${() => this.handlePreviousPage()}');
    expect(src).toContain('@next-page=${() => this.handleNextPage()}');
  });
});
