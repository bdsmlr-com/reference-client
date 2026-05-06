import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { baseStyles } from '../styles/theme.js';
import { extractRenderableTags, type ProcessedPost } from '../types/post.js';
import { formatDateShort, getTooltipDate } from '../services/date-formatter.js';
import { sanitizeHtmlFragment } from '../services/html-sanitizer.js';
import { toPresentationModel } from '../services/post-presentation.js';
import { resolveLink } from '../services/link-resolver.js';
import { buildContextualTagSearchHref, type PostRouteSource } from '../services/post-route-context.js';
import type { IdentityDecoration } from '../types/api.js';
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
      .media-stage {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        max-height: min(78vh, 920px);
        min-height: 220px;
        padding: 10px;
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.05), transparent 55%),
          #050505;
        overflow: hidden;
      }
      .media-stage media-renderer {
        max-width: 100%;
        max-height: calc(min(78vh, 920px) - 20px);
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
  @property({ type: String }) surface: 'detail' | 'lightbox' = 'detail';
  @property({ type: String }) from = 'direct';

  private renderMicroBlogIdentity(
    link: ReturnType<typeof resolveLink> | null | undefined,
    label: string,
    decoration?: IdentityDecoration | null,
    blogId?: number | null,
  ) {
    const normalized = `${label || link?.label || ''}`.trim().replace(/^@+/, '');
    if (!normalized) return nothing;
    const identity = html`
      <blog-identity
        variant="micro"
        .blogName=${normalized}
        .blogId=${blogId || 0}
        .identityDecorations=${decoration ? [decoration] : []}
      ></blog-identity>
    `;
    if (!link) return identity;
    return html`<a href=${link.href} target=${link.target} rel=${link.rel || nothing} title=${link.title || nothing}>${identity}</a>`;
  }

  render() {
    if (!this.post) return nothing;
    const p = this.post;
    const presentation = toPresentationModel(p, {
      surface: this.surface === 'lightbox' ? 'lightbox' : 'detail',
      page: 'post',
    });
    const recommendationsMode = this.surface === 'lightbox' ? 'list' : 'grid';
    const engagementStandalone = false;
    const tags = extractRenderableTags(p);
    const bodyHtml = p.content?.html || p.body || p.content?.text || p.content?.title || '';
    const media = p._media;
    const rawUrl = media?.type === 'video'
      ? (media.videoUrl || media.url)
      : (media?.url || media?.videoUrl || media?.audioUrl);
    const posterSrc = media?.type === 'video' && media.url && media.url !== rawUrl ? media.url : undefined;
    const permalink = presentation.identity.permalink;
    const typeIcon = presentation.identity.postTypeIcon || '📄';

    return html`
      <section class="post-page">
        <div class="identity-row">
          <div class="identity-line">
            <span>${typeIcon}</span>
            ${presentation.identity.isReblog
              ? html`
                  ${this.renderMicroBlogIdentity(
                    presentation.identity.originBlog,
                    presentation.identity.originBlogLabel,
                    presentation.identity.originBlogDecoration,
                    p.originBlogId,
                  )}
                  ${presentation.identity.originPostPermalink
                    ? html`<span class="identity-slash">/</span><a href=${presentation.identity.originPostPermalink.href} target=${presentation.identity.originPostPermalink.target} rel=${presentation.identity.originPostPermalink.rel || nothing}>${presentation.identity.originPostPermalink.label || p.originPostId}<span class="identity-outlink">${presentation.identity.originPostPermalink.icon || '↗'}</span></a>`
                    : nothing}
                  <span>via ♻️</span>
                  ${this.renderMicroBlogIdentity(
                    presentation.identity.viaBlog,
                    presentation.identity.viaBlogLabel,
                    presentation.identity.viaBlogDecoration,
                    p.blogId,
                  )}
                  ${presentation.identity.viaPostPermalink
                    ? html`<span class="identity-slash">/</span><a href=${presentation.identity.viaPostPermalink.href} target=${presentation.identity.viaPostPermalink.target} rel=${presentation.identity.viaPostPermalink.rel || nothing}>${presentation.identity.viaPostPermalink.label || p.id}<span class="identity-outlink">${presentation.identity.viaPostPermalink.icon || '↗'}</span></a>`
                    : nothing}
                `
              : html`
                  ${this.renderMicroBlogIdentity(
                    presentation.identity.viaBlog || presentation.identity.originBlog,
                    presentation.identity.primaryBlogLabel,
                    presentation.identity.viaBlogDecoration || presentation.identity.originBlogDecoration,
                    p.blogId,
                  )}
                  <span class="identity-slash">/</span>
                  <a href=${permalink.href} target=${permalink.target} rel=${permalink.rel || nothing}>
                    ${permalink.label || p.id}<span class="identity-outlink">${permalink.icon || '↗'}</span>
                  </a>
                `}
          </div>
          <time class="post-date" title=${getTooltipDate(p.createdAtUnix)}>${formatDateShort(p.createdAtUnix)}</time>
        </div>

        ${rawUrl ? html`
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

        ${presentation.layout.showTags && tags.length > 0 ? html`
          <div class="post-tags">
            ${tags.map((tag) => {
              const href = buildContextualTagSearchHref(tag, p, this.from as PostRouteSource);
              return html`<a class="tag-chip" href=${href}>#${tag}</a>`;
            })}
          </div>
        ` : nothing}

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
