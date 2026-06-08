import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

function read(relPath: string): string {
  return readFileSync(relPath.startsWith('/') ? relPath : join(process.cwd(), relPath), 'utf8');
}

describe('v2 transport namespace wiring', () => {
  it('emits assets under /v2/assets and proxies /v2/api in vite config', () => {
    const src = read('vite.config.ts');

    expect(src).toContain("base: '/v2/assets/'");
    expect(src).toContain("assetsDir: ''");
    expect(src).toContain("url.startsWith('/v2/api')");
    expect(src).toContain("'/v2/api/recs'");
    expect(src).toContain("'/v2/api'");
  });

  it('serves assets from /v2/assets while retaining the legacy asset alias', () => {
    const routesSrc = read('routes.py');

    expect(routesSrc).toContain("@client_blueprint.route('/v2/assets/<path:filename>')");
    expect(routesSrc).toContain("@client_blueprint.route('/assets/<path:filename>')");
    expect(routesSrc).toContain("root_candidate = os.path.join(_dist_dir, filename)");
    expect(routesSrc).toContain("return send_from_directory(_dist_dir, filename)");
  });

  it('defaults runtime API and auth calls to the /v2 namespace', () => {
    const apiSrc = read(join(ROOT, 'services/api.ts'));
    const authSrc = read(join(ROOT, 'services/auth-service.ts'));
    const recSrc = read(join(ROOT, 'services/recommendation-api.ts'));

    expect(apiSrc).toContain("const DEFAULT_API_BASE = '/v2/api';");
    expect(apiSrc).toContain("API_BASE.endsWith('/v2/api')");
    expect(apiSrc).toContain("return `${API_BASE}/${clean.slice(3)}`;");
    expect(apiSrc).toContain("const endpointPath = buildTransportPath(normalizedEndpoint);");
    expect(apiSrc).toContain("fetch(buildTransportPath(endpoint), {");

    expect(authSrc).toContain("const DEFAULT_BASE = '/v2/api/auth';");
    expect(recSrc).toContain("const API_BASE = '/v2/api/recs';");
  });
});
