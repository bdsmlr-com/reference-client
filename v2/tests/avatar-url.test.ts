import { describe, expect, it } from 'vitest';

import { normalizeAvatarUrl } from '../src/services/avatar-url.js';

describe('normalizeAvatarUrl', () => {
  it('preserves already proxied imgproxy avatar URLs', () => {
    const url =
      'https://imgproxy.i.bdsmlr.com/unsafe/g:sm/rs:fill:300:300/plain/s3://ocdn012.bdsmlr.com/uploads/blogs/2019/05/711549/avatar/711549-MHHOH1eqlo1.jpg';

    expect(normalizeAvatarUrl(url)).toBe(url);
  });

  it('normalizes direct legacy avatar hosts without rewriting URL paths', () => {
    expect(normalizeAvatarUrl('https://ocdn012.bdsmlr.com/uploads/blogs/avatar.jpg')).toBe(
      'https://cdn012.bdsmlr.com/uploads/blogs/avatar.jpg',
    );
  });

  it('converts relative avatar paths to the current avatar CDN host', () => {
    expect(normalizeAvatarUrl('/uploads/blogs/avatar.jpg')).toBe(
      'https://cdn012.bdsmlr.com/uploads/blogs/avatar.jpg',
    );
  });
});
