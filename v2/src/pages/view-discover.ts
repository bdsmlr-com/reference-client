import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { recService, materializeRecommendedPosts, type RecResult } from '../services/recommendation-api.js';
import { buildPageUrl, getPrimaryBlogName } from '../services/blog-resolver.js';
import { getGalleryMode, PROFILE_EVENTS, type GalleryMode } from '../services/profile.js';
import { scrollObserver } from '../services/scroll-observer.js';
import type { ProcessedPost } from '../types/post.js';
import '../components/post-grid.js';
import '../components/blog-card.js';
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
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
        margin-top: 20px;
      }
      h2 { color: var(--accent); margin-bottom: 8px; }
      .section { margin-bottom: 40px; }
    `
  ];

  @property({ type: String }) blog = '';
  @state() private recommendedPosts: ProcessedPost[] = [];
  @state() private recommendedBlogs: RecResult[] = [];
  @state() private usingCanonicalPosts = false;
  @state() private loading = false;
  @state() private galleryMode: GalleryMode = getGalleryMode();
  @state() private exhausted = false;
  @state() private infiniteScroll = false;
  @state() private nextOffset = 0;

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
      this.nextOffset = 0;
    }
    const blogName = this.blog || getPrimaryBlogName() || 'LittleWays';
    try {
      const response = await recService.getRecommendedPostsForUser(
        blogName,
        ViewDiscover.PAGE_SIZE,
        this.nextOffset,
      );
      if (Array.isArray(response.posts)) {
        this.usingCanonicalPosts = true;
        const newPosts = materializeRecommendedPosts(response);
        this.recommendedPosts = reset ? newPosts : [...this.recommendedPosts, ...newPosts];
        this.nextOffset += ViewDiscover.PAGE_SIZE;
        if (newPosts.length < ViewDiscover.PAGE_SIZE || this.recommendedPosts.length >= 96) {
          this.exhausted = true;
        }
        return;
      }

      if (reset) {
        this.recommendedBlogs = await recService.getRecommendedBlogsForUser(blogName, 12);
        this.exhausted = true;
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
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

    return html`
      <result-group
        wide
        bare
        .title=${'Recommended Blogs for You'}
        .description=${'Based on your liking patterns and similar audiences.'}
      >
        <div class="grid">
          ${this.recommendedBlogs.map(rec => html`
            <blog-card .blogName=${rec.content_id}></blog-card>
          `)}
        </div>
      </result-group>
    `;
  }
}
