import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/post-feed-item.ts');

describe('post feed item identity rendering', () => {
  it('uses compact micro blog identities in card headers without avatars', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("import './blog-identity.js';");
    expect(src).toContain('private renderMicroBlogIdentity(');
    expect(src).toContain('variant="micro"');
    expect(src).toContain('.showAvatar=${false}');
    expect(src).toContain('♻️ via ${this.renderMicroBlogIdentity(');
  });
});
