import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('app-root anonymous read gating', () => {
  it('allows canonical public blog and post routes to render without auth', () => {
    const src = readFileSync(join(process.cwd(), 'src/app-root.ts'), 'utf8');

    expect(src).toContain("import { isAnonymousReadableRoute } from './services/route-access-policy.js';");
    expect(src).toContain("moreLikeThisOnPost: FEATURE_FLAGS.more_like_this_on_post === true");
    expect(src).toContain('maybeDeployInterstitial(false, {');
    expect(src).toContain('if (!this.runtimeConfigReady || (this.checkingAuth && !allowAnonymousRead)) {');
    expect(src).toContain('if (!this.authenticated && !allowAnonymousRead) {');
  });
});
