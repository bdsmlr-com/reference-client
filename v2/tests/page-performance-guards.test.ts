import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');

describe('page performance guards', () => {
  it('gives heavy archive and recommendation endpoints explicit timeout budgets', () => {
    const src = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');

    expect(src).toContain("'/v2/list-blog-activity': 30000");
    expect(src).toContain("'/v2/list-blog-top-tags': 30000");
    expect(src).toContain("'/v2/list-recommended-blogs': 30000");
  });

  it('does not block social followers/following pages on recommended-blog hydration', () => {
    const src = readFileSync(join(ROOT, 'pages/view-social.ts'), 'utf8');

    expect(src).not.toContain('await Promise.all([this.fetchPage(), this.loadRecommendedBlogs()]);');
    expect(src).toContain('await this.fetchPage();');
    expect(src).toContain('void this.loadRecommendedBlogs();');
    expect(src).toContain('private recommendedBlogsLoadedFor =');
    expect(src).toContain('private recommendedBlogsPromise: Promise<void> | null = null;');
  });

  it('does not block feed rendering on interaction-cluster enrichment', () => {
    const src = readFileSync(join(ROOT, 'pages/view-feed.ts'), 'utf8');

    expect(src).toContain('const MAX_CLUSTER_FETCH_BLOGS = 3;');
    expect(src).toContain('private clusterLoadGeneration = 0;');
    expect(src).toContain('void this.fetchAndAppendInteractionClusters(activeBlogIds.slice(0, MAX_CLUSTER_FETCH_BLOGS), clusterGeneration);');
    expect(src).toContain('private async fetchAndAppendInteractionClusters(blogIds: number[], generation: number): Promise<void>');
    expect(src).toContain('this.blogData?.id || await apiClient.identity.resolveNameToId(name)');
  });

  it('reuses themed blog ids on archive and defers tag-cloud loading until after posts', () => {
    const src = readFileSync(join(ROOT, 'pages/view-archive.ts'), 'utf8');

    expect(src).toContain('this.blogData?.id || await apiClient.identity.resolveNameToId(this.blog)');
    expect(src).toContain('await initBlogTheme(this.blog, { includeArchiveBounds: true })');
    expect(src).toContain('await this.loadPosts({ preserveNavigationState: true });');
    expect(src).toContain('this.scheduleArchiveTagCloudLoad();');
    expect(src).toContain('private scheduleArchiveTagCloudLoad(): void');
  });


  it('does not eagerly hydrate post action viewer state on initial render', () => {
    const src = readFileSync(join(ROOT, 'components/post-actions.ts'), 'utf8');

    expect(src).toContain('this.syncLocalStateFromCache();');
    expect(src).toContain('await this.ensureActorStateHydrated();');
    expect(src).not.toContain('void this.syncActorState();');
    expect(src).not.toContain('scheduleSyncActorState()');
  });

  it('does not block post detail on optional origin-post hydration', () => {
    const src = readFileSync(join(ROOT, 'pages/view-post.ts'), 'utf8');

    expect(src).toContain('this.loading = false;');
    expect(src).toContain('this.scheduleOriginPostLoad(resp.post.originPostId, id);');
    expect(src).toContain('private scheduleOriginPostLoad(originPostId: number, expectedPostId: number): void');
    expect(src).toContain('window.setTimeout(() => {');
    expect(src).toContain('void this.loadOriginPost(originPostId, expectedPostId);');
  });


  it('routes apex API traffic directly to api-prod instead of the redirected apex /v2/api path', () => {
    const src = readFileSync(join(ROOT, 'services/api.ts'), 'utf8');
    const helperSrc = readFileSync(join(ROOT, 'services/transport-base.ts'), 'utf8');

    expect(src).toContain("import { resolveTransportBase } from './transport-base.js';");
    expect(src).toContain("function resolveApiBase(): string");
    expect(src).toContain("return resolveTransportBase('api', {");
    expect(helperSrc).toContain("const DEFAULT_APEX_API_BASE = 'https://api-prod.bdsmlr.com/v2/api';");
    expect(helperSrc).toContain("normalized === 'bdsmlr.com' || normalized === 'www.bdsmlr.com'");
    expect(helperSrc).toContain("return DEFAULT_APEX_API_BASE;");
    expect(helperSrc).toContain("return `${apexBase}/auth`;");
    expect(helperSrc).toContain("return `${apexBase}/recs`;");
    expect(helperSrc).not.toContain('VITE_PUBLIC_API_BASE_URL');
  });

  it('routes apex auth traffic directly to api-prod instead of the redirected apex /v2/api/auth path', () => {
    const src = readFileSync(join(ROOT, 'services/auth-service.ts'), 'utf8');

    expect(src).toContain("import { isApexRuntime, resolveTransportBase } from './transport-base.js';")
    expect(src).toContain("const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;")
    expect(src).toContain("return resolveTransportBase('auth', {");
    expect(src).toContain("mode: isApexRuntime({")
    expect(src).not.toContain('VITE_PUBLIC_READ_AUTH_BASE_URL');
  });

  it('routes apex recommendation traffic directly to api-prod instead of the redirected apex /v2/api/recs path', () => {
    const src = readFileSync(join(ROOT, 'services/recommendation-api.ts'), 'utf8');

    expect(src).toContain("import { resolveTransportBase } from './transport-base.js';");
    expect(src).toContain("return resolveTransportBase('recs', {");
    expect(src).not.toContain('VITE_PUBLIC_READ_RECS_BASE_URL');
  });

});
