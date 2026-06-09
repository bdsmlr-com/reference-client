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

  it('defaults runtime API, auth, and recommendation calls through the shared transport resolver', () => {
    const apiSrc = read(join(ROOT, 'services/api.ts'));
    const authSrc = read(join(ROOT, 'services/auth-service.ts'));
    const recSrc = read(join(ROOT, 'services/recommendation-api.ts'));
    const transportSrc = read(join(ROOT, 'services/transport-base.ts'));

    expect(transportSrc).toContain("export function resolveTransportBase(scope: TransportScope, context: TransportContext): string");
    expect(transportSrc).toContain("const DEFAULT_APEX_API_BASE = 'https://api-prod.bdsmlr.com/v2/api';");
    expect(transportSrc).toContain("return `${apexBase}/auth`;");
    expect(transportSrc).toContain("return `${apexBase}/recs`;");
    expect(transportSrc).not.toContain('VITE_PUBLIC_API_BASE_URL');

    expect(apiSrc).toContain("import { resolveTransportBase } from './transport-base.js';");
    expect(apiSrc).toContain("function resolveApiBase(): string");
    expect(apiSrc).toContain("return resolveTransportBase('api', {");
    expect(apiSrc).toContain("const endpointPath = buildTransportPath(normalizedEndpoint);");

    expect(authSrc).toContain("import { isApexRuntime, resolveTransportBase } from './transport-base.js';");
    expect(authSrc).toContain("return resolveTransportBase('auth', {");

    expect(recSrc).toContain("import { resolveTransportBase } from './transport-base.js';");
    expect(recSrc).toContain("return resolveTransportBase('recs', {");
    expect(recSrc).not.toContain('VITE_PUBLIC_READ_RECS_BASE_URL');
  });
});
