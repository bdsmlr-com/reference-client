import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post deleted detail policy', () => {
  it('renders a dedicated gone state on the post route for HTTP 410 responses', () => {
    const src = readFileSync(join(ROOT, 'pages/view-post.ts'), 'utf8');

    expect(src).toContain("import { getContextualErrorMessage, isApiError } from '../services/api-error.js';");
    expect(src).toContain('apiError?.statusCode === 410');
    expect(src).toContain("this.error = '410 Gone. This post has been deleted.';");
  });

  // DEVB-2573: Guards the temporary originBlogGone workaround on direct post routes until
  // banned/deleted propagation is fixed in the API and search index.
  it('blocks direct post detail when origin blog is gone for non-admin viewers', () => {
    const src = readFileSync(join(ROOT, 'pages/view-post.ts'), 'utf8');

    expect(src).toContain("import { isAdminMode } from '../services/blog-resolver.js';");
    expect(src).toContain('!isAdminMode() && resp.post.originBlogGone');
    expect(src).toContain("this.error = 'This post is no longer available.';");
  });

  it('adds deleted chrome to post detail for elevated viewers', () => {
    const src = readFileSync(join(ROOT, 'components/post-detail-content.ts'), 'utf8');

    expect(src).toContain("import { isAdminMode } from '../services/blog-resolver.js';");
    expect(src).toContain("const isDeleted = Boolean(p.deletedAtUnix);");
    expect(src).toContain("const isOriginDeleted = Boolean(p.originDeletedAtUnix);");
    expect(src).toContain('class="admin-state-strip"');
    expect(src).toContain("class=${isDeleted ? 'identity-post-link strikethrough' : 'identity-post-link'}");
  });
});
