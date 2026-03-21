import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

const ADMIN_CONSUMERS = [
  'app-root.ts',
  'pages/view-feed.ts',
  'components/post-card.ts',
  'components/activity-grid.ts',
  'components/post-recommendations.ts',
];

describe('admin mode consistency', () => {
  it('uses isAdminMode() instead of raw query-param checks in UI surfaces', () => {
    for (const rel of ADMIN_CONSUMERS) {
      const full = join(ROOT, rel);
      const src = readFileSync(full, 'utf8');

      expect(src).toContain('isAdminMode');
      expect(src).not.toContain("new URLSearchParams(window.location.search).get('admin') === 'true'");
    }
  });

  it('routes admin API calls with admin=true query param in apiRequest', () => {
    const apiSrc = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');

    expect(apiSrc).toContain('const endpointUrl = new URL(`${API_BASE}${normalizedEndpoint}`, window.location.origin);');
    expect(apiSrc).toContain("endpointUrl.searchParams.set('admin', 'true')");
    expect(apiSrc).toContain('fetch(endpointUrl.toString()');
  });

  it('does not filter deleted posts or aggressive dedupe in admin mode', () => {
    const feedSrc = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');
    const archiveSrc = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(feedSrc).toContain('if (post.deletedAtUnix && !isAdmin) continue;');
    expect(archiveSrc).toContain('const isAdmin = isAdminMode();');
    expect(archiveSrc).toContain('if (!isAdmin && (this.seenIds.has(post.id) || this.renderedMediaKeys.has(contentKey)))');
  });
});
