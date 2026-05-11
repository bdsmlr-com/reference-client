import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { apiClient } from '../services/client.js';
import { materializeRecommendedPosts } from '../services/recommendation-api.js';
import { buildPageUrl, getPrimaryBlogName } from '../services/blog-resolver.js';
import { getGalleryMode, PROFILE_EVENTS, type GalleryMode } from '../services/profile.js';
import { scrollObserver } from '../services/scroll-observer.js';
import type { ProcessedPost } from '../types/post.js';
import type { Blog, FollowEdge } from '../types/api.js';
import '../components/post-grid.js';
import '../components/blog-list.js';
import '../components/loading-spinner.js';
import '../components/load-footer.js';
import '../components/result-group.js';

@customElement('view-discover')
export class ViewDiscover extends LitElement {
  private static readonly PAGE_SIZE = 24;

  static styles = [
    baseStyles,
    css`
      :host { display: block; padding: 20px 16px; }
      h2 { color: var(--accent); margin-bottom: 8px; }
      .section { margin-bottom: 40px; }
    `
  ];

  @property({ type: String }) blog = '';
  @state() private recommendedPosts: ProcessedPost[] = [];
  @state() private recommendedBlogs: FollowEdge[] = [];
  @state() private usingCanonicalPosts = false;
  @state() private loading = false;
  @state() private galleryMode: GalleryMode = getGalleryMode();
  @state() private exhausted = false;
  @state() private infiniteScroll = false;
  @state() private nextPageToken: string | null = null;

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener(PROFILE_EVENTS.galleryModeChanged, this.handleGalleryModeChanged as EventListener);
    await this.loadRecommendations(true);
    this.observeSentinel();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(PROFILE_EVENTS.galleryModeChanged, this.handleGalleryModeChanged as EventListener);
    const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
    if (sentinel) {
      scrollObserver.unobserve(sentinel);
    }
  }

  private handleGalleryModeChanged = (): void => {
    this.galleryMode = getGalleryMode();
  };

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('blog')) {
      void this.loadRecommendations(true);
    }
  }

  private observeSentinel(): void {
    requestAnimationFrame(() => {
      const sentinel = this.shadowRoot?.querySelector('#scroll-sentinel');
      if (sentinel) {
        scrollObserver.observe(sentinel, () => {
          if (this.infiniteScroll && !this.loading && !this.exhausted && this.usingCanonicalPosts) {
            void this.loadRecommendations(false);
          }
        });
      }
    });
  }

  private async loadRecommendations(reset: boolean) {
    if (this.loading) return;
    this.loading = true;
    if (reset) {
      this.usingCanonicalPosts = false;
      this.recommendedPosts = [];
      this.recommendedBlogs = [];
      this.exhausted = false;
      this.nextPageToken = null;
    }
    const blogName = this.blog || getPrimaryBlogName() || 'LittleWays';
    try {
      const recommendedBlogsPromise = reset
        ? this.loadRecommendedBlogs(blogName)
        : Promise.resolve(this.recommendedBlogs);
      const [response, recommendedBlogs] = await Promise.all([
        apiClient.posts.forYou({
          perspective_blog_name: blogName,
          page_size: ViewDiscover.PAGE_SIZE,
          page_token: this.nextPageToken || undefined,
        }),
        recommendedBlogsPromise,
      ]);

      if (this.blog && this.blog !== blogName) {
        return;
      }

      if (reset) {
        this.recommendedBlogs = recommendedBlogs;
      }

      if (Array.isArray(response.posts)) {
        this.usingCanonicalPosts = true;
        const newPosts = materializeRecommendedPosts(response);
        this.recommendedPosts = reset ? newPosts : [...this.recommendedPosts, ...newPosts];
        this.nextPageToken = response.page?.nextPageToken || null;
        if (newPosts.length < ViewDiscover.PAGE_SIZE || this.recommendedPosts.length >= 96) {
          this.exhausted = true;
        }
        if (!this.nextPageToken) {
          this.exhausted = true;
        }
        return;
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  private mapRecommendedBlog(blog: Blog): FollowEdge {
    return {
      blogId: blog.id,
      blogName: blog.name,
      ownerUserId: blog.ownerUserId,
      title: blog.title,
      description: blog.description,
      avatarUrl: blog.avatarUrl,
      followersCount: blog.followersCount,
      postsCount: blog.postsCount,
      createdAt: blog.createdAt,
      identityDecorations: blog.identityDecorations,
    };
  }

  private async loadRecommendedBlogs(blogName: string): Promise<FollowEdge[]> {
    try {
      const response = await apiClient.blogs.listRecommended({
        blog_name: blogName,
        limit: 12,
      });
      if (this.blog && this.blog !== blogName) {
        return [];
      }
      return Array.isArray(response.blogs) ? response.blogs.map((blog) => this.mapRecommendedBlog(blog)) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  render() {
    if (this.loading) return html`<loading-spinner></loading-spinner>`;

    if (this.usingCanonicalPosts) {
      const subjectBlog = this.blog || getPrimaryBlogName() || '';
      const primaryBlog = getPrimaryBlogName() || '';
      const isPrimaryPerspective = !!subjectBlog && subjectBlog === primaryBlog;
      const title = isPrimaryPerspective ? 'For You' : `For @${subjectBlog}`;
      const description = isPrimaryPerspective
        ? 'Recommended posts based on your activity and interests.'
        : `Recommended posts for the perspective of @${subjectBlog}.`;
      const targetHref = subjectBlog ? buildPageUrl('for', subjectBlog) : '';
      return html`
        <result-group
          wide
          bare
          .title=${title}
          .description=${description}
          .actionHref=${window.location.pathname === targetHref ? '' : targetHref}
          .actionLabel=${'See more'}
        >
          <post-grid .posts=${this.recommendedPosts} .page=${'search'} .mode=${this.galleryMode}></post-grid>
        </result-group>
        ${this.recommendedBlogs.length > 0
          ? html`
              <result-group
                wide
                bare
                .title=${'Blogs you may like'}
                .description=${'Based on your liking patterns and similar audiences.'}
                .actionHref=${subjectBlog ? buildPageUrl('social', subjectBlog) : ''}
                .actionLabel=${'See more'}
              >
                <blog-list .items=${this.recommendedBlogs}></blog-list>
              </result-group>
            `
          : ''}
        <load-footer
          mode="search"
          pageName="discover"
          .loading=${this.loading}
          .exhausted=${this.exhausted}
          .loadingTarget=${ViewDiscover.PAGE_SIZE}
          .infiniteScroll=${this.infiniteScroll}
          @load-more=${() => this.loadRecommendations(false)}
          @infinite-toggle=${(e: CustomEvent) => {
            this.infiniteScroll = e.detail.enabled;
            if (this.infiniteScroll) this.observeSentinel();
          }}
        ></load-footer>
        <div id="scroll-sentinel" style="height:1px;" aria-hidden="true"></div>
      `;
    }

    if (this.recommendedBlogs.length > 0) {
      const subjectBlog = this.blog || getPrimaryBlogName() || '';
      return html`
        <result-group
          wide
          bare
          .title=${'Blogs you may like'}
          .description=${'Based on your liking patterns and similar audiences.'}
          .actionHref=${subjectBlog ? buildPageUrl('social', subjectBlog) : ''}
          .actionLabel=${'See more'}
        >
          <blog-list .items=${this.recommendedBlogs}></blog-list>
        </result-group>
      `;
    }

    return html``;
  }
}
