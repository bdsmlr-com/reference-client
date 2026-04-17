import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('post actions strip', () => {
  it('defines a shared post-actions component with actor-scoped like state wiring', () => {
    const src = readFileSync(join(ROOT, 'components/post-actions.ts'), 'utf8');

    expect(src).toContain("@customElement('post-actions')");
    expect(src).toContain("import { createEngagementStateController } from '../services/engagement-state.js';");
    expect(src).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(src).toContain('engagementState.subscribe(');
    expect(src).toContain('unsubscribeLikeState');
    expect(src).toContain('handleSharedStateChanged');
    expect(src).toContain("variant: 'card' | 'detail'");
    expect(src).toContain('likeState');
    expect(src).toContain('reblogCount');
    expect(src).toContain('commentCount');
    expect(src).toContain('toggleLike');
    expect(src).toContain('triggerReblog');
    expect(src).toContain('openCommentModal');
    expect(src).toContain('submitComment');
    expect(src).toContain('hydrateReblogStates');
    expect(src).toContain('getReblogCount');
    expect(src).toContain('reblogPost');
    expect(src).toContain('commentPost');
    expect(src).toContain('stopPropagation()');
    expect(src).toContain('preventDefault()');
    expect(src).toContain("dispatchEvent(new CustomEvent('engagement-open-tab'");
    expect(src).toContain('openEngagementTab');
    expect(src).toContain('count-chip-button');
    expect(src).toContain('like-active');
    expect(src).toContain('reblog-active');
    expect(src).toContain('comment-active');
    expect(src).toContain('icon-btn');
    expect(src).toContain('liking');
    expect(src).toContain("openEngagementTab('likes'");
    expect(src).toContain("openEngagementTab('reblogs'");
    expect(src).toContain("openEngagementTab('comments'");
    expect(src).toContain('likeAction.icon');
    expect(src).toContain('textarea');
    expect(src).toContain('modal-backdrop');
    expect(src).toContain('commenting');
    expect(src).toContain('const presentation = toPresentationModel');
    expect(src).toContain('const likeCount = likeAction.count ?? 0;');
    expect(src).toContain('const reblogCount = reblogAction.count ?? 0;');
    expect(src).toContain('const commentCount = this.commentCount ?? commentAction.count ?? 0;');
    expect(src).not.toContain('You reblogged');
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
    expect(src).toContain("import { toPresentationModel } from '../services/post-presentation.js';");
    expect(src).toContain('<post-actions');
    expect(src).toContain('variant="detail"');
    expect(src).toContain('const presentation = toPresentationModel');
    expect(src).toContain("@engagement-open-tab=${this.handleOpenTab}");
    expect(src).toContain('handleOpenTab');
    expect(src).toContain('renderEngagementDetail()');
  });

  it('adds the comment write helper to the api and engagement controller layers', () => {
    const apiSrc = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');
    const stateSrc = readFileSync(join(ROOT, 'services/engagement-state.ts'), 'utf8');

    expect(apiSrc).toContain("'/v2/internal-write/comment'");
    expect(apiSrc).toContain('commentPost(');
    expect(stateSrc).toContain('commentPost(req: CommentPostRequest)');
    expect(stateSrc).toContain('getCommentCount');
  });
});
