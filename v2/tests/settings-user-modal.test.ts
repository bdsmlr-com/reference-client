import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('settings user modal', () => {
  it('opens owned blogs in a centered modal instead of direct card navigation', () => {
    const src = readFileSync(join(ROOT, 'pages/view-settings-user.ts'), 'utf8');

    expect(src).toContain("@state() private selectedBlog: SettingsBlog | null = null;");
    expect(src).toContain('private openBlog(blog: SettingsBlog): void');
    expect(src).toContain('private renderSelectedBlogModal()');
    expect(src).toContain('class="modal-backdrop"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain('handleAvatarImageError');
    expect(src).toContain('normalizeAvatarUrl');
    expect(src).toContain('variant="micro"');
    expect(src).toContain('Open blog settings');
    expect(src).not.toContain('<a class="card" href=');
  });
});
