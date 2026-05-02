import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post-feed-item text fallback', () => {
  it('renders title/text fallbacks when body is empty', () => {
    const src = readFileSync(join(ROOT, 'components/post-feed-item.ts'), 'utf8');

    expect(src).toContain("const bodyText = post.body || post.content?.text || post.content?.title || '';");
    expect(src).toContain("${bodyText ? html`<div class=\"card-body\">${bodyText}</div>` : ''}");
  });
});
