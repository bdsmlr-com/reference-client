import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { recService, type RecResult } from '../services/recommendation-api.js';
import { getPrimaryBlogName } from '../services/blog-resolver.js';
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

  @state() private recommendedBlogs: RecResult[] = [];
  @state() private loading = true;

  async connectedCallback() {
    super.connectedCallback();
    await this.loadRecommendations();
  }

  async loadRecommendations() {
    this.loading = true;
    const blogName = getPrimaryBlogName() || 'LittleWays';
    try {
      // Fetch both similar to current and generic recs if possible
      this.recommendedBlogs = await recService.getRecommendedBlogsForUser(blogName, 12);
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) return html`<loading-spinner></loading-spinner>`;

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
