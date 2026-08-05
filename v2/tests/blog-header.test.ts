// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAuthChecking, setAuthUser, clearAuthUser } from '../src/state/auth-state.js';
import { followStateController } from '../src/services/follow-state.js';
import { blockedStateController } from '../src/services/blocked-state.js';
import '../src/components/blog-header.js';

describe('blog-header', () => {
  let hydrateFollowStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    hydrateFollowStateSpy = vi.spyOn(followStateController, 'hydrateFollowState').mockResolvedValue(false);
    vi.spyOn(blockedStateController, 'hydrateBlockedState').mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAuthUser();
    document.body.innerHTML = '';
  });

  it('renders follower and following counts in the summary card', async () => {
    const el = document.createElement('blog-header') as any;
    el.page = 'archive';
    el.blogId = 42;
    el.blogName = 'wifefantasy';
    el.blogTitle = 'Title';
    el.blogDescription = '<p>Hello <strong>world</strong></p>';
    el.followersCount = 1234;
    el.followingCount = 321;
    document.body.appendChild(el);

    await el.updateComplete;

    const root = el.shadowRoot!;
    const summary = root.querySelector('.summary-copy')?.textContent || '';
    expect(summary).toContain('1,234');
    expect(summary).toContain('Followers');
    expect(summary).toContain('321');
    expect(summary).toContain('Following');
    expect(root.querySelector('.summary-description')?.innerHTML).toContain('<p>Hello <strong>world</strong></p>');

    root.querySelector('.summary-card-main')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;
    expect(root.querySelector('.modal-description')?.innerHTML).toContain('<p>Hello <strong>world</strong></p>');
  });

  it('keeps the action menu visible for eligible activity pages regardless of resolved follow state', async () => {
    hydrateFollowStateSpy.mockResolvedValueOnce(true);
    setAuthUser({ userId: 1, blogId: 5, activeBlogId: 5, blogName: 'actor', activeBlogName: 'actor' });
    const el = document.createElement('blog-header') as any;
    el.page = 'activity';
    el.blogId = 77;
    el.blogName = 'demo';
    document.body.appendChild(el);

    await el.updateComplete;
    await Promise.resolve();
    await el.updateComplete;

    expect(el.shadowRoot?.querySelector('.menu-trigger')).toBeTruthy();
  });

  it('opens messaging for the trimmed viewed blog name and closes the menu', async () => {
    setAuthUser({ userId: 1, blogId: 5, activeBlogId: 5, blogName: 'actor', activeBlogName: 'actor' });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const el = document.createElement('blog-header') as any;
    el.page = 'activity';
    el.blogId = 77;
    el.blogName = '  demo blog  ';
    document.body.appendChild(el);

    await el.updateComplete;
    el.shadowRoot?.querySelector<HTMLButtonElement>('.menu-trigger')?.click();
    await el.updateComplete;

    const messageButton = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.menu-item')]
      .find((button) => button.textContent?.trim() === 'Send message');
    expect(messageButton).toBeTruthy();
    messageButton?.click();
    await el.updateComplete;

    expect(openSpy).toHaveBeenCalledWith(
      'https://bdsmlr.com/messages?to=demo%20blog',
      '_blank',
      'noopener,noreferrer',
    );
    expect(el.shadowRoot?.querySelector('.menu-popover')).toBeNull();
  });

  it('shows Send message when pending auth resolves without remounting', async () => {
    clearAuthUser();
    setAuthChecking(true);
    const el = document.createElement('blog-header') as any;
    el.page = 'activity';
    el.blogId = 77;
    el.blogName = 'demo';
    document.body.appendChild(el);

    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('.menu-trigger')).toBeNull();

    setAuthUser({ userId: 1, blogId: 5, activeBlogId: 5, blogName: 'actor', activeBlogName: 'actor' });
    await el.updateComplete;

    el.shadowRoot?.querySelector<HTMLButtonElement>('.menu-trigger')?.click();
    await el.updateComplete;

    expect(el.shadowRoot?.textContent).toContain('Send message');
  });

  it.each([
    ['anonymous', () => clearAuthUser(), 77, 'demo', false],
    ['unresolved auth', () => {
      setAuthUser({ userId: 1, blogId: 5, activeBlogId: 5 });
      setAuthChecking(true);
    }, 77, 'demo', true],
    ['self blog', () => setAuthUser({ userId: 1, blogId: 5, activeBlogId: 5 }), 5, 'demo', false],
    ['empty blog name', () => setAuthUser({ userId: 1, blogId: 5, activeBlogId: 5 }), 77, '   ', true],
  ])('does not expose Send message for %s views', async (_label, configureAuth, blogId, blogName, expectsTrigger) => {
    configureAuth();
    const el = document.createElement('blog-header') as any;
    el.page = 'activity';
    el.blogId = blogId;
    el.blogName = blogName;
    document.body.appendChild(el);

    await el.updateComplete;

    const trigger = el.shadowRoot?.querySelector<HTMLButtonElement>('.menu-trigger');
    expect(Boolean(trigger)).toBe(expectsTrigger);
    trigger?.click();
    await el.updateComplete;

    const messageButton = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.menu-item')]
      .find((button) => button.textContent?.trim() === 'Send message');
    expect(messageButton).toBeUndefined();
  });
});
