// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import '../src/components/blog-card.js';
import { apiClient } from '../src/services/client.js';

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('blog-card', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders sanitized description html and following stats', async () => {
    const originalGet = apiClient.blogs.get;
    apiClient.blogs.get = async () => ({ blog: { avatarUrl: '/avatar.jpg' } } as any);

    const el = document.createElement('blog-card') as any;
    el.blog = {
      id: 42,
      name: 'themunch',
      description: '<p>Hello <strong>world</strong><script>alert(1)</script></p>',
      followersCount: 1234,
      followingCount: 321,
    };
    document.body.appendChild(el);

    await el.updateComplete;
    await flushMicrotasks();
    await el.updateComplete;

    const root = el.shadowRoot!;
    const title = root.querySelector('.blog-title');
    const stats = root.querySelectorAll('.stat');

    expect(title?.innerHTML).toContain('<p>Hello <strong>world</strong></p>');
    expect(title?.innerHTML).not.toContain('<script');
    expect(stats[0].textContent).toContain('1,234');
    expect(stats[0].textContent).toContain('Followers');
    expect(stats[1].textContent).toContain('321');
    expect(stats[1].textContent).toContain('Following');
    apiClient.blogs.get = originalGet;
  });
});
