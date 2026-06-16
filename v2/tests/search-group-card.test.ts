// @vitest-environment happy-dom
import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '../src/components/activity-grid.js';
import '../src/components/post-feed-item.js';

const FILE = join(process.cwd(), 'src/components/search-group-card.ts');

function makeTextOnlyPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    blogId: 11,
    blogName: 'ActorOne',
    originBlogId: 11,
    originBlogName: 'ActorOne',
    createdAtUnix: 1718400000,
    updatedAtUnix: 1718400300,
    likesCount: 3,
    reblogsCount: 1,
    commentsCount: 0,
    tags: ['tagged'],
    type: 1,
    variant: 1,
    body: 'This is a deliberately long text-only post that should be truncated into a readable snippet for compact activity cards while keeping the full card clickable.',
    title: '',
    content: {
      files: [],
      html: '<p>This is a deliberately long <strong>text-only</strong> post that should be truncated into a readable snippet for compact activity cards while keeping the full card clickable.</p>',
      text: 'This is a deliberately long text-only post that should be truncated into a readable snippet for compact activity cards while keeping the full card clickable.',
      title: null,
      url: null,
      thumbnail: null,
      description: null,
      quoteText: null,
      quoteSource: null,
    },
    _media: {
      type: 'text',
      text: 'This is a deliberately long text-only post that should be truncated into a readable snippet for compact activity cards while keeping the full card clickable.',
      html: '<p>This is a deliberately long <strong>text-only</strong> post that should be truncated into a readable snippet for compact activity cards while keeping the full card clickable.</p>',
    },
    ...overrides,
  } as any;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('search group card', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('dispatches shared post-click events for the representative post instead of hard-jumping to the origin post page', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("new CustomEvent('post-click'");
    expect(src).toContain('detail: { post: this.post, from: this.page }');
    expect(src).not.toContain("window.location.href = `/post/${this.originPostId}`;");
    expect(src).not.toContain('search-group-click');
  });

  it('shows the archive blog reblog date only in archive context', () => {
    const src = readFileSync(FILE, 'utf8');

    expect(src).toContain("@property({ type: String }) page: 'archive' | 'search' | 'post' | 'activity' | 'feed' | 'social' = 'search';");
    expect(src).toContain("const archiveReblogDate = this.page === 'archive' ? formatDate(this.post.createdAtUnix, 'date') : '';");
    expect(src).toContain("import './blog-identity.js';");
    expect(src).toContain('class="archive-origin-line"');
    expect(src).toContain('<blog-identity');
    expect(src).toContain('.showAvatar=${false}');
    expect(src).toContain("${archiveReblogDate ? html`<div class=\"archive-reblog-date\">${archiveReblogDate}</div>` : ''}");
    expect(src).toContain('<div class="stats-line">');
  });

  it('shows actor identity on feed activity cards but keeps blog activity cards in self-context presentation', async () => {
    const actorContext = document.createElement('activity-grid') as any;
    actorContext.items = [{ post: makeTextOnlyPost(), type: 'like' }];
    actorContext.page = 'feed';
    actorContext.showBlogChip = true;
    actorContext.activityCardVariant = 'actor-context';
    document.body.appendChild(actorContext);
    await actorContext.updateComplete;
    await flushMicrotasks();
    await actorContext.updateComplete;

    const actorItem = actorContext.shadowRoot?.querySelector('activity-item') as any;
    await actorItem?.updateComplete;
    const actorIdentity = actorItem?.shadowRoot?.querySelector('blog-identity') as any;
    expect(actorIdentity?.blogName).toBe('ActorOne');

    const selfContext = document.createElement('activity-grid') as any;
    selfContext.items = [{ post: makeTextOnlyPost({ id: 2, blogName: 'ActorTwo', originBlogName: 'ActorTwo' }), type: 'like' }];
    selfContext.page = 'activity';
    selfContext.showBlogChip = false;
    selfContext.activityCardVariant = 'self-context';
    document.body.appendChild(selfContext);
    await selfContext.updateComplete;
    await flushMicrotasks();
    await selfContext.updateComplete;

    const selfItem = selfContext.shadowRoot?.querySelector('activity-item') as any;
    await selfItem?.updateComplete;
    expect(selfItem?.shadowRoot?.querySelector('blog-identity')).toBeNull();
  });

  it('renders truncated snippets and overlay links on text-only small cards across compact surfaces', async () => {
    for (const page of ['archive', 'search', 'feed', 'activity'] as const) {
      const el = document.createElement('activity-grid') as any;
      el.items = [{ post: makeTextOnlyPost({ id: page.length + 10 }), type: page === 'feed' ? 'like' : 'post' }];
      el.page = page;
      el.activityCardVariant = page === 'feed' ? 'actor-context' : 'self-context';
      el.showBlogChip = page === 'feed';
      document.body.appendChild(el);

      await el.updateComplete;
      await flushMicrotasks();
      await el.updateComplete;

      const item = el.shadowRoot?.querySelector('activity-item') as any;
      await item?.updateComplete;
      const shadow = item?.shadowRoot;
      const snippetText = shadow?.querySelector('.text-snippet')?.textContent || '';
      expect(snippetText).toContain('This is a deliberately long text-only post');
      expect(snippetText).toContain('...');
      expect(shadow?.querySelector('.card-overlay-link')).toBeTruthy();
      el.remove();
    }
  });

  it('preserves formatted text markup on large blog timeline cards', async () => {
    const el = document.createElement('post-feed-item') as any;
    el.post = makeTextOnlyPost({
      id: 99,
      content: {
        files: [],
        html: '<p><strong>Bold</strong> and <em>formatted</em> text</p>',
        text: 'Bold and formatted text',
        title: null,
        url: null,
        thumbnail: null,
        description: null,
        quoteText: null,
        quoteSource: null,
      },
      body: 'Bold and formatted text',
    });
    el.page = 'activity';
    document.body.appendChild(el);

    await el.updateComplete;
    await flushMicrotasks();
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.card-body strong')?.textContent).toBe('Bold');
    expect(el.shadowRoot?.querySelector('.card-body em')?.textContent).toBe('formatted');
  });
});
