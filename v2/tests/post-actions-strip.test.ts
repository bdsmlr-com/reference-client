import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post actions strip', () => {
  it('defines a shared post-actions component with actor-scoped like state wiring', () => {
    const src = readFileSync(join(ROOT, 'components/post-actions.ts'), 'utf8');

    expect(src).toContain("@customElement('post-actions')");
    expect(src).toContain("import { createEngagementStateController } from '../services/engagement-state.js';");
    expect(src).toContain('engagementState.subscribe(');
    expect(src).toContain('unsubscribeLikeState');
    expect(src).toContain('handleSharedStateChanged');
    expect(src).toContain("variant: 'card' | 'detail'");
    expect(src).toContain('likesCount');
    expect(src).toContain('reblogsCount');
    expect(src).toContain('commentsCount');
    expect(src).toContain('likeState');
    expect(src).toContain('toggleLike');
    expect(src).toContain('stopPropagation()');
    expect(src).toContain('preventDefault()');
  });

  it('cards compose the shared action strip in card mode without changing the surrounding layout', () => {
    const src = readFileSync(join(ROOT, 'components/post-card.ts'), 'utf8');

    expect(src).toContain("import './post-actions.js';");
    expect(src).toContain('<post-actions');
    expect(src).toContain('variant="card"');
    expect(src).toContain('media-container');
    expect(src).toContain('card-body');
  });

  it('post engagement composes the shared action strip in detail mode and keeps detail tabs intact', () => {
    const src = readFileSync(join(ROOT, 'components/post-engagement.ts'), 'utf8');

    expect(src).toContain("import './post-actions.js';");
    expect(src).toContain('<post-actions');
    expect(src).toContain('variant="detail"');
    expect(src).toContain("toggleTab('likes')");
    expect(src).toContain("toggleTab('reblogs')");
    expect(src).toContain("toggleTab('comments')");
    expect(src).toContain('renderEngagementDetail()');
  });
});
