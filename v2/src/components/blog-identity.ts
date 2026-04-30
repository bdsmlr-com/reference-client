import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import { handleAvatarImageError, normalizeAvatarUrl } from '../services/avatar-url.js';
import type { IdentityDecoration } from '../types/api.js';

type BlogIdentityVariant = 'header' | 'menu';

function pickInlineDecoration(
  decorations: IdentityDecoration[] | null | undefined,
): IdentityDecoration | null {
  const eligible = (decorations || [])
    .filter((decoration) => (decoration.visibility || []).includes('inline_name'))
    .sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER));
  return eligible[0] ?? null;
}

function normalizeBlogName(blogName: string): string {
  return blogName.trim().replace(/^@+/, '');
}

function hashBlogName(blogName: string): number {
  let hash = 0;
  for (let i = 0; i < blogName.length; i += 1) {
    hash = (hash * 31 + blogName.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function deriveAccentColor(blogName: string): string {
  const normalized = normalizeBlogName(blogName) || 'blog';
  const hue = hashBlogName(normalized) % 360;
  return `hsl(${hue} 64% 46%)`;
}

function srgbToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function parseColorToRgb(color: string): [number, number, number] | null {
  const normalized = color.trim().toLowerCase();

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  const hslMatch = normalized.match(/^hsl\(\s*([-\d.]+)(?:deg)?\s+([-\d.]+)%\s+([-\d.]+)%\s*\)$/i);
  if (hslMatch) {
    return hslToRgb(Number(hslMatch[1]), Number(hslMatch[2]), Number(hslMatch[3]));
  }

  const rgbMatch = normalized.match(/^rgb\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/i);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }

  return null;
}

function getReadableAccentForeground(accentColor: string): string {
  try {
    const rgb = parseColorToRgb(accentColor);
    if (!rgb) {
      return '#ffffff';
    }
    const [r, g, b] = rgb;
    const luminance = 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
    return luminance >= 0.45 ? '#0f172a' : '#ffffff';
  } catch {
    return '#ffffff';
  }
}

@customElement('blog-identity')
export class BlogIdentity extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: inline-block;
        min-width: 0;
        --blog-identity-accent: hsl(220 60% 48%);
      }

      .identity {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      :host([variant='menu']) .identity {
        gap: 8px;
      }

      .avatar-stack {
        position: relative;
        flex: 0 0 auto;
      }

      .avatar,
      .avatar-fallback {
        border-radius: 999px;
        overflow: hidden;
      }

      .avatar {
        display: block;
        object-fit: cover;
      }

      .avatar-fallback {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--blog-identity-accent);
        color: var(--blog-identity-accent-foreground);
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .copy {
        display: flex;
        flex-direction: column;
        min-width: 0;
        gap: 2px;
      }

      .name {
        min-width: 0;
        color: var(--blog-identity-accent);
        font-weight: 700;
        line-height: 1.15;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .name-row {
        display: inline-flex;
        align-items: baseline;
        gap: 0.35em;
        min-width: 0;
      }

      .name-decoration {
        color: var(--text-primary);
        flex: 0 0 auto;
      }

      .title {
        min-width: 0;
        color: var(--text-muted);
        line-height: 1.25;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .description {
        min-width: 0;
        color: var(--text-muted);
        line-height: 1.35;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      :host([variant='header']) .avatar,
      :host([variant='header']) .avatar-fallback {
        width: 40px;
        height: 40px;
      }

      :host([variant='header']) .name {
        font-size: 18px;
      }

      :host([variant='header']) .title {
        font-size: 12px;
        max-width: 40ch;
      }

      :host([variant='header']) .description {
        font-size: 12px;
        max-width: 52ch;
      }

      :host([variant='menu']) .avatar,
      :host([variant='menu']) .avatar-fallback {
        width: 28px;
        height: 28px;
      }

      :host([variant='menu']) .avatar-fallback {
        font-size: 12px;
      }

      :host([variant='menu']) .name {
        font-size: 13px;
      }

      :host([variant='menu']) .title {
        font-size: 11px;
        max-width: 20ch;
      }

      :host([variant='menu']) .description {
        display: none;
      }
    `,
  ];

  @property({ type: String }) blogName = '';
  @property({ type: String }) blogTitle = '';
  @property({ type: String }) blogDescription = '';
  @property({ type: String }) avatarUrl = '';
  @property({ attribute: false }) identityDecorations: IdentityDecoration[] = [];
  @property({ type: String, reflect: true }) variant: BlogIdentityVariant = 'header';

  private get normalizedBlogName(): string {
    return normalizeBlogName(this.blogName);
  }

  private get accent(): string {
    return deriveAccentColor(this.normalizedBlogName);
  }

  private get accentForeground(): string {
    return getReadableAccentForeground(this.accent);
  }

  private get resolvedAvatarUrl(): string | null {
    return normalizeAvatarUrl(this.avatarUrl);
  }

  render() {
    const blogName = this.normalizedBlogName;
    if (!blogName) {
      return nothing;
    }

    const initial = (blogName.charAt(0) || '?').toUpperCase();
    const avatarUrl = this.resolvedAvatarUrl;
    const title = this.blogTitle.trim();
    const description = this.blogDescription.trim();
    const decoration = pickInlineDecoration(this.identityDecorations);

    return html`
      <div
        class="identity"
        style=${`--blog-identity-accent: ${this.accent}; --blog-identity-accent-foreground: ${this.accentForeground};`}
      >
        <span class="avatar-stack" aria-hidden="true">
          ${avatarUrl
            ? html`
                <img
                  class="avatar"
                  src=${avatarUrl}
                  alt=${`Avatar for @${blogName}`}
                  @error=${handleAvatarImageError}
                />
                <span class="avatar-fallback" style="display: none;">${initial}</span>
              `
            : html`<span class="avatar-fallback">${initial}</span>`}
        </span>
        <span class="copy">
          <span class="name-row">
            <span class="name">@${blogName}</span>
            ${decoration?.icon ? html`<span class="name-decoration" title=${decoration.label || nothing}>${decoration.icon}</span>` : nothing}
          </span>
          ${title ? html`<span class="title">${title}</span>` : nothing}
          ${description ? html`<span class="description">${description}</span>` : nothing}
        </span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blog-identity': BlogIdentity;
  }
}
