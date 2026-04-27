import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { recService, materializeRecommendedPosts, type RecResult } from '../services/recommendation-api.js';
import { buildPageUrl, getPrimaryBlogName } from '../services/blog-resolver.js';
import type { ProcessedPost } from '../types/post.js';
import '../components/post-grid.js';
import '../components/blog-card.js';
import '../components/loading-spinner.js';
import '../components/result-group.js';

@customElement('view-discover')
export class ViewDiscover extends LitElement {
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
  @state() private loading = true;

  async connectedCallback() {
    super.connectedCallback();
    await this.loadRecommendations();
  }

  async loadRecommendations() {
    this.loading = true;
    this.usingCanonicalPosts = false;
    this.recommendedPosts = [];
    this.recommendedBlogs = [];
    const blogName = this.blog || getPrimaryBlogName() || 'LittleWays';
    try {
      const response = await recService.getRecommendedPostsForUser(blogName, 12);
      if (Array.isArray(response.posts)) {
        this.usingCanonicalPosts = true;
        this.recommendedPosts = materializeRecommendedPosts(response);
        return;
      }

      this.recommendedBlogs = await recService.getRecommendedBlogsForUser(blogName, 12);
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
      const targetHref = subjectBlog ? buildPageUrl('for', subjectBlog) : '';
      return html`
        <result-group
          wide
          bare
          .title=${'For You'}
          .description=${'Recommended posts based on your activity and interests.'}
          .actionHref=${window.location.pathname === targetHref ? '' : targetHref}
          .actionLabel=${'See more'}
        >
          <post-grid .posts=${this.recommendedPosts} .page=${'social'}></post-grid>
        </result-group>
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
