import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { recService, materializeRecommendedPosts, type RecResult } from '../services/recommendation-api.js';
import { getPrimaryBlogName } from '../services/blog-resolver.js';
import type { ProcessedPost } from '../types/post.js';
import '../components/post-grid.js';
import '../components/blog-card.js';
import '../components/loading-spinner.js';

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
    const blogName = getPrimaryBlogName() || 'LittleWays';
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
      return html`
        <div class="section">
          <h2>For You</h2>
          <p class="text-muted">Recommended posts based on your activity and interests.</p>
          <post-grid .posts=${this.recommendedPosts} .page=${'social'}></post-grid>
        </div>
      `;
    }

    return html`
      <div class="section">
        <h2>Recommended Blogs for You</h2>
        <p class="text-muted">Based on your liking patterns and similar audiences.</p>
        <div class="grid">
          ${this.recommendedBlogs.map(rec => html`
            <blog-card .blogName=${rec.content_id}></blog-card>
          `)}
        </div>
      </div>
    `;
  }
}
