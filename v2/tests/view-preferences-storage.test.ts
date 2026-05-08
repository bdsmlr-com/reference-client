import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('view preferences storage', () => {
  it('supports page-scoped gallery preferences and distinct follower-feed activity kinds', () => {
    const profileSrc = readFileSync(join(ROOT, 'services/profile.ts'), 'utf8');
    const timelineSrc = readFileSync(join(ROOT, 'services/timeline-route-controller.ts'), 'utf8');

    expect(profileSrc).toContain('const FOLLOWER_FEED_ACTIVITY_KINDS_KEY');
    expect(profileSrc).toContain('export function getFollowerFeedActivityKindsPreference()');
    expect(profileSrc).toContain('export function setFollowerFeedActivityKindsPreference(');
    expect(profileSrc).toContain('export function getGalleryMode(scope?: string)');
    expect(profileSrc).toContain('export function setGalleryMode(mode: GalleryMode, scope?: string)');

    expect(timelineSrc).toContain('getFollowerFeedActivityKindsPreference');
    expect(timelineSrc).toContain('setFollowerFeedActivityKindsPreference');
    expect(timelineSrc).toContain("controlPageName: 'followers'");
  });
});
