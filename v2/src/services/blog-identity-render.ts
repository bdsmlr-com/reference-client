import { html, nothing, type TemplateResult } from 'lit';
import type { IdentityDecoration } from '../types/api.js';
import type { ResolvedLink } from './link-resolver.js';

type RenderMicroBlogIdentityOptions = {
  link?: ResolvedLink | null;
  label?: string | null;
  blogId?: number | null;
  decoration?: IdentityDecoration | null;
  decorations?: IdentityDecoration[] | null;
  className?: string;
  title?: string | null;
  stopClick?: boolean;
  showAvatar?: boolean;
};

export function normalizeStructuredBlogName(label: string | null | undefined, blogId?: number | null): string {
  const raw = `${label || ''}`.trim().replace(/^@+/, '');
  if (raw.toLowerCase() === 'unknown' && (blogId || 0) > 0) {
    return '';
  }
  return raw;
}

export function renderStructuredMicroBlogIdentity({
  link,
  label,
  blogId,
  decoration,
  decorations,
  className,
  title,
  stopClick = false,
  showAvatar = false,
}: RenderMicroBlogIdentityOptions): TemplateResult | typeof nothing {
  const normalized = normalizeStructuredBlogName(label, blogId);
  if (!normalized && !(blogId || 0)) {
    return nothing;
  }
  const identityDecorations = decorations ?? (decoration ? [decoration] : []);
  const identity = html`
    <blog-identity
      variant="micro"
      .blogName=${normalized}
      .blogId=${blogId || 0}
      .showAvatar=${showAvatar}
      .identityDecorations=${identityDecorations}
    ></blog-identity>
  `;
  if (!link) {
    return identity;
  }
  return html`
    <a
      class=${className || nothing}
      href=${link.href}
      target=${link.target}
      rel=${link.rel || nothing}
      title=${title ?? link.title ?? nothing}
      @click=${stopClick ? ((event: Event) => event.stopPropagation()) : nothing}
    >${identity}</a>
  `;
}
