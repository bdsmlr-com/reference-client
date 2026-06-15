import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('build tag format', () => {
  it('build script exports FE and BE shas into VITE_BUILD_SHA', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const build = pkg?.scripts?.build || '';

    expect(build).toContain("VITE_BUILD_ENV=${VITE_BUILD_ENV:-${APP_ENV:-$(grep '^APP_ENV=' ../../../.env 2>/dev/null | cut -d= -f2-)}}");
    expect(build).toContain('VITE_BUILD_ENV=${VITE_BUILD_ENV:-staging}');
    expect(build).toContain('VITE_FE_SHA=');
    expect(build).toContain('VITE_BE_SHA=');
    expect(build).toContain('${VITE_BUILD_ENV}@${VITE_BE_SHA}-${VITE_FE_SHA}');
  });

  it('shared nav fallback uses env@unknown-unknown shape', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/shared-nav.ts'), 'utf8');
    expect(src).toContain("|| 'staging@unknown-unknown'");
  });

  it('api image dockerfile builds frontend from the shared reference-client tree', () => {
    const dockerfile = readFileSync(join(process.cwd(), '../../../images/api.Dockerfile'), 'utf8');

    expect(dockerfile).toContain('COPY apps/reference-client/v2/package.json ./');
    expect(dockerfile).toContain('COPY apps/reference-client/v2/package-lock.json ./');
    expect(dockerfile).toContain('COPY apps/reference-client/v2/ ./');
    expect(dockerfile).toContain("VITE_FE_SHA_COMPUTED=\"${VITE_FE_SHA:-$(find . -path './node_modules' -prune -o -type f -print0 | sort -z | xargs -0 sha1sum | sha1sum | cut -c1-7)}\"");
    expect(dockerfile).not.toContain('COPY apps/api/v2/third-party/reference-client/v2/');
    expect(dockerfile).not.toContain('build-meta/api-fe.sha');
  });
});
