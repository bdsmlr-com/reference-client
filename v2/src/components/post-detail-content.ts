import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { baseStyles } from '../styles/theme.js';
import { extractRenderableTags, type ProcessedPost } from '../types/post.js';
import { formatDateShort, getTooltipDate } from '../services/date-formatter.js';
import { sanitizeHtmlFragment } from '../services/html-sanitizer.js';
import { toPresentationModel } from '../services/post-presentation.js';
import { renderStructuredMicroBlogIdentity } from '../services/blog-identity-render.js';
import { resolvePostDetailMediaUrl } from '../services/media-resolver.js';
import { isAdminMode } from '../services/blog-resolver.js';
import {
  buildContextualTagSearchHref,
  buildScopedReblogDetailTagHref,
  type PostRouteSource,
} from '../services/post-route-context.js';
import './media-renderer.js';
import './blog-identity.js';
import './post-engagement.js';
import './post-recommendations.js';

@customElement('post-detail-content')
export class PostDetailContent extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host { display: block; }
      .post-page {
        display: grid;
        gap: 18px;
      }
      .identity-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .identity-line {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        min-width: 0;
        color: var(--text);
      }
      .identity-line a {
        color: inherit;
        text-decoration: none;
      }
      .identity-post-link.strikethrough {
        text-decoration: line-through;
        opacity: 0.72;
      }
      .identity-line a:hover {
        color: var(--accent);
      }
      .identity-slash {
        color: var(--text-muted);
      }
      .identity-outlink {
        font-size: 12px;
        opacity: 0.72;
      }
      .post-date {
        font-size: 12px;
        color: var(--text-muted);
      }
      .admin-state-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .state-pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border: 1px solid var(--border);
        color: var(--text-muted);
      }
      .state-pill.deleted,
      .state-pill.origin-deleted {
        border-color: color-mix(in srgb, var(--error) 45%, var(--border));
        color: var(--error);
      }
      .media-stage {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        max-height: min(78vh, 920px);
        min-height: 0;
        padding: 0;
        background: transparent;
        overflow: visible;
      }
      .media-stage media-renderer {
        width: auto;
        height: auto;
        max-width: min(100%, calc(100vw - 40px));
        max-height: calc(min(78vh, 920px) - 20px);
        flex: 0 1 auto;
      }
      .media-gallery {
        display: grid;
        gap: 14px;
      }
      .media-gallery .media-stage {
        max-height: none;
      }
      .post-title {
        margin: 0;
        font-size: clamp(28px, 4vw, 40px);
        line-height: 1.08;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text);
      }
      .body-text {
        border-bottom: 1px solid var(--border-subtle);
        padding-bottom: 20px;
      }

      .post-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
      }

      .tag-sections {
        display: grid;
        gap: 14px;
        margin-bottom: 20px;
      }

      .tag-section {
        display: grid;
        gap: 8px;
      }

      .tag-section-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .tag-chip {
        font-size: 12px;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 3px 9px;
        color: var(--accent);
        text-decoration: none;
      }

      .tag-chip:hover {
        border-color: var(--accent);
      }
    `,
  ];

  @property({ type: Object }) post: ProcessedPost | null = null;
  @property({ type: Object }) originPost: ProcessedPost | null = null;
  @property({ type: String }) surface: 'detail' | 'lightbox' = 'detail';
  @property({ type: String }) from = 'direct';

  render() {
    if (!this.post) return nothing;
    const p = this.post;
    const presentation = toPresentationModel(p, {
      surface: this.surface === 'lightbox' ? 'lightbox' : 'detail',
      page: 'post',
    });
    const recommendationsMode = this.surface === 'lightbox' ? 'list' : 'grid';
    const engagementStandalone = false;
    const reblogTags = extractRenderableTags(p);
    const originTags = this.originPost ? extractRenderableTags(this.originPost) : [];
    const tags = presentation.identity.isReblog ? [] : reblogTags;
    const bodyHtml = p.content?.html || p.body || p.content?.text || p.content?.title || '';
    const titleText = (p.title || p.content?.title || '').trim();
    const media = p._media;
    const mediaFiles = p.content?.files || [];
    const multiImageUrls = p.type === 2 && mediaFiles.length > 1 ? mediaFiles : [];
    const rawUrl = resolvePostDetailMediaUrl(media?.type === 'video' ? (media.videoUrl || media.url) : (media?.url || media?.videoUrl || media?.audioUrl));
    const posterSrc = media?.type === 'video' && media.url && media.url !== rawUrl ? resolvePostDetailMediaUrl(media.url) : undefined;
    const permalink = presentation.identity.permalink;
    const typeIcon = presentation.identity.postTypeIcon || '📄';
    const isAdmin = isAdminMode();
    const isDeleted = Boolean(p.deletedAtUnix);
    const isOriginDeleted = Boolean(p.originDeletedAtUnix);
    const viaBlogName = `${p.blogName || presentation.identity.viaBlogLabel || ''}`.trim().replace(/^@+/, '');
    const originBlogName = `${p.originBlogName || presentation.identity.originBlogLabel || ''}`.trim().replace(/^@+/, '');

    return html`
      <section class="post-page">
        ${isAdmin && (isDeleted || isOriginDeleted) ? html`
          <div class="admin-state-strip">
            ${isDeleted ? html`<span class="state-pill deleted">deleted</span>` : nothing}
            ${isOriginDeleted ? html`<span class="state-pill origin-deleted">origin deleted</span>` : nothing}
          </div>
        ` : nothing}

        <div class="identity-row">
          <div class="identity-line">
            <span>${typeIcon}</span>
            ${presentation.identity.isReblog
              ? html`
                  ${renderStructuredMicroBlogIdentity({
                    link: presentation.identity.originBlog,
                    label: presentation.identity.originBlogLabel,
                    blogId: p.originBlogId,
                    decoration: presentation.identity.originBlogDecoration,
                    strikethrough: presentation.identity.originBlogGone,
                  })}
                  ${presentation.identity.originPostPermalink
                    ? html`<span class="identity-slash">/</span><a class=${isOriginDeleted ? 'identity-post-link strikethrough' : 'identity-post-link'} href=${presentation.identity.originPostPermalink.href} target=${presentation.identity.originPostPermalink.target} rel=${presentation.identity.originPostPermalink.rel || nothing}>${presentation.identity.originPostPermalink.label || p.originPostId}<span class="identity-outlink">${presentation.identity.originPostPermalink.icon || '↗'}</span></a>`
                    : nothing}
                  <span>via ♻️</span>
                  ${renderStructuredMicroBlogIdentity({
                    link: presentation.identity.viaBlog,
                    label: presentation.identity.viaBlogLabel,
                    blogId: p.blogId,
                    decoration: presentation.identity.viaBlogDecoration,
                  })}
                  ${presentation.identity.viaPostPermalink
                    ? html`<span class="identity-slash">/</span><a class=${isDeleted ? 'identity-post-link strikethrough' : 'identity-post-link'} href=${presentation.identity.viaPostPermalink.href} target=${presentation.identity.viaPostPermalink.target} rel=${presentation.identity.viaPostPermalink.rel || nothing}>${presentation.identity.viaPostPermalink.label || p.id}<span class="identity-outlink">${presentation.identity.viaPostPermalink.icon || '↗'}</span></a>`
                    : nothing}
                  ${presentation.identity.legacyPostPermalink
                    ? html`<span class="identity-slash">/</span><a href=${presentation.identity.legacyPostPermalink.href} target=${presentation.identity.legacyPostPermalink.target} rel=${presentation.identity.legacyPostPermalink.rel || nothing} title=${presentation.identity.legacyPostPermalink.title || nothing}>${presentation.identity.legacyPostPermalink.icon || '🗿↗'}</a>`
                    : nothing}
                `
              : html`
                  ${renderStructuredMicroBlogIdentity({
                    link: presentation.identity.viaBlog || presentation.identity.originBlog,
                    label: presentation.identity.primaryBlogLabel,
                    blogId: p.blogId,
                    decoration: presentation.identity.viaBlogDecoration || presentation.identity.originBlogDecoration,
                  })}
                  <span class="identity-slash">/</span>
                  <a class=${isDeleted ? 'identity-post-link strikethrough' : 'identity-post-link'} href=${permalink.href} target=${permalink.target} rel=${permalink.rel || nothing}>
                    ${permalink.label || p.id}<span class="identity-outlink">${permalink.icon || '↗'}</span>
                  </a>
                  ${presentation.identity.legacyPostPermalink
                    ? html`<span class="identity-slash">/</span><a href=${presentation.identity.legacyPostPermalink.href} target=${presentation.identity.legacyPostPermalink.target} rel=${presentation.identity.legacyPostPermalink.rel || nothing} title=${presentation.identity.legacyPostPermalink.title || nothing}>${presentation.identity.legacyPostPermalink.icon || '🗿↗'}</a>`
                    : nothing}
                `}
          </div>
          <time class="post-date" title=${getTooltipDate(p.createdAtUnix)}>${formatDateShort(p.createdAtUnix)}</time>
        </div>

        ${titleText ? html`<h1 class="post-title">${titleText}</h1>` : nothing}

        ${multiImageUrls.length > 0 ? html`
          <div class="media-gallery">
            ${multiImageUrls.map((fileUrl) => html`
              <div class="media-stage">
                <media-renderer
                  .src=${resolvePostDetailMediaUrl(fileUrl)}
                  .type=${'detail'}
                ></media-renderer>
              </div>
            `)}
          </div>
        ` : rawUrl ? html`
          <div class="media-stage">
            <media-renderer
              .src=${rawUrl}
              .posterSrc=${posterSrc}
              .type=${'detail'}
              .autoplayVideo=${false}
              .controlsVideo=${true}
              .loopVideo=${true}
            ></media-renderer>
          </div>
        ` : nothing}

        <div class="body-text">
          ${unsafeHTML(sanitizeHtmlFragment(bodyHtml))}
        </div>

        ${presentation.layout.showTags && presentation.identity.isReblog
          ? html`
              <div class="tag-sections">
                ${reblogTags.length > 0
                  ? html`
                      <div class="tag-section">
                        <div class="tag-section-label">${viaBlogName || 'Reblogger'} tagged:</div>
                        <div class="post-tags">
                          ${reblogTags.map((tag) => {
                            const href = buildScopedReblogDetailTagHref(tag, viaBlogName, this.from as PostRouteSource);
                            return html`<a class="tag-chip" href=${href}>#${tag}</a>`;
                          })}
                        </div>
                      </div>
                    `
                  : nothing}
                ${originTags.length > 0
                  ? html`
                      <div class="tag-section">
                        <div class="tag-section-label">${originBlogName || 'Origin'} tagged:</div>
                        <div class="post-tags">
                          ${originTags.map((tag) => {
                            const href = buildScopedReblogDetailTagHref(tag, originBlogName, this.from as PostRouteSource);
                            return html`<a class="tag-chip" href=${href}>#${tag}</a>`;
                          })}
                        </div>
                      </div>
                    `
                  : nothing}
              </div>
            `
          : presentation.layout.showTags && tags.length > 0
            ? html`
                <div class="post-tags">
                  ${tags.map((tag) => {
                    const href = buildContextualTagSearchHref(tag, p, this.from as PostRouteSource);
                    return html`<a class="tag-chip" href=${href}>#${tag}</a>`;
                  })}
                </div>
              `
            : nothing}

        <post-engagement .post=${p} .from=${this.from as PostRouteSource} ?standalone=${engagementStandalone}></post-engagement>

        ${presentation.layout.showRecommendations
          ? html`<post-recommendations .postId=${p.id} .mode=${recommendationsMode} .showBrowseLink=${true} .from=${this.from as PostRouteSource}></post-recommendations>`
          : nothing}
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'post-detail-content': PostDetailContent;
  }
}
