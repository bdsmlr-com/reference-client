import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'src/components/post-card.ts');

describe('post card presentation', () => {
  it('drives header links from the shared presentation model', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(src).toContain("@property({ type: String }) page: 'feed' | 'archive' | 'search' | 'activity' | 'post' | 'social' = 'archive';");
    expect(src).toContain("const presentation = toPresentationModel(p, { surface: 'card', page: this.page });");
    expect(src).toContain("const mediaRenderType = presentation.media.preset as MediaRenderType;");
    expect(src).toContain("presentation.identity.postTypeIcon");
    expect(src).toContain("presentation.media.type === 'video'");
    expect(src).toContain(".type=${mediaRenderType}");
    expect(src).toContain('href=${presentation.identity.permalink.href}');
    expect(src).toContain("import './blog-identity.js';");
    expect(src).toContain('private renderMicroBlogIdentity(');
    expect(src).toContain('variant=\"micro\"');
    expect(src).toContain('.showAvatar=${false}');
    expect(src).toContain('href=${link.href}');
    expect(src).toContain('target=${link.target}');
    expect(src).toContain('presentation.identity.originBlogLabel');
    expect(src).toContain('presentation.identity.viaBlogLabel');
    expect(src).toContain('presentation.identity.originBlogDecoration');
    expect(src).toContain('presentation.identity.viaBlogDecoration');
    expect(src).toContain("@click=${(event: Event) => event.stopPropagation()}");
    expect(src).not.toContain('POST_TYPE_ICONS[p.type as PostType]');
    expect(src).toContain('.tag {');
    expect(src).toContain('color: var(--text);');
  });
});
