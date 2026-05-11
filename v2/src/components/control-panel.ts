import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { Blog, PostType, PostVariant } from '../types/api.js';
import type { ActivityKind } from '../services/profile.js';
import './route-shell-card.js';
import './activity-kind-pills.js';
import './archive-when-picker.js';
import './gallery-mode-picker.js';
import './infinite-scroll-toggle.js';
import './sort-controls.js';
import './type-pills.js';
import './variant-pills.js';

@customElement('control-panel')
export class ControlPanel extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        margin-bottom: 20px;
        padding: 0 16px;
      }

      .control-row {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .separator {
        color: var(--border);
        font-size: 14px;
        line-height: 1;
        user-select: none;
      }
    `,
  ];

  @property({ type: String }) sortValue = '';
  @property({ attribute: false }) sortOptions: Array<{ value: string; label: string }> = [];
  @property({ type: Array }) selectedTypes: PostType[] = [];
  @property({ type: Array }) selectedVariants: PostVariant[] = [];
  @property({ type: Array }) activityKinds: ActivityKind[] = [];
  @property({ type: String }) whenValue = '';
  @property({ type: Object }) blog: Blog | null = null;
  @property({ type: String }) pageName = '';
  @property({ type: String }) galleryMode: 'grid' | 'masonry' = 'grid';
  @property({ type: Boolean }) infiniteScroll = false;
  @property({ type: String }) settingsHref = '';
  @property({ type: Boolean }) showSort = false;
  @property({ type: Boolean }) showTypes = false;
  @property({ type: Boolean }) showVariants = false;
  @property({ type: Boolean }) showActivityKinds = false;
  @property({ type: Boolean }) showWhen = false;
  @property({ type: Boolean }) showGalleryMode = false;
  @property({ type: Boolean }) showInfiniteScroll = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) framed = true;

  private handleSortChange(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('sort-change', { detail: e.detail }));
  }

  private handleTypesChange(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('types-change', { detail: e.detail }));
  }

  private handleVariantChange(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('variant-change', { detail: e.detail }));
  }

  private handleActivityKindsChange(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('activity-kinds-change', { detail: e.detail }));
  }

  private handleWhenChange(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('when-change', { detail: e.detail }));
  }

  private handleGalleryModeChange(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('gallery-mode-change', { detail: e.detail }));
  }

  private handleInfiniteToggle(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('infinite-toggle', { detail: e.detail }));
  }

  private intersperse(parts: TemplateResult[]): TemplateResult[] {
    return parts.flatMap((part, index) => (
      index === 0 ? [part] : [html`<span class="separator" aria-hidden="true">|</span>`, part]
    ));
  }

  render() {
    const sections: TemplateResult[] = [];

    if (this.showSort) {
      sections.push(html`
        <sort-controls .value=${this.sortValue} .options=${this.sortOptions} @sort-change=${this.handleSortChange}></sort-controls>
      `);
    }

    if (this.showActivityKinds) {
      sections.push(html`
        <activity-kind-pills .selected=${this.activityKinds} @activity-kinds-change=${this.handleActivityKindsChange}></activity-kind-pills>
      `);
    }

    if (this.showTypes) {
      sections.push(html`
        <type-pills
          .selectedTypes=${this.selectedTypes}
          .pageName=${this.pageName}
          @types-change=${this.handleTypesChange}
        ></type-pills>
      `);
    }

    if (this.showVariants) {
      sections.push(html`
        <variant-pills
          .loading=${this.loading}
          .selectedVariants=${this.selectedVariants}
          .pageName=${this.pageName}
          @variant-change=${this.handleVariantChange}
        ></variant-pills>
      `);
    }

    if (this.showWhen) {
      sections.push(html`
        <archive-when-picker .blog=${this.blog} .value=${this.whenValue} @when-change=${this.handleWhenChange}></archive-when-picker>
      `);
    }

    if (this.showGalleryMode) {
      sections.push(html`
        <gallery-mode-picker
          .value=${this.galleryMode}
          .pageName=${this.pageName}
          @gallery-mode-change=${this.handleGalleryModeChange}
        ></gallery-mode-picker>
      `);
    }

    if (this.showInfiniteScroll) {
      sections.push(html`
        <infinite-scroll-toggle
          .enabled=${this.infiniteScroll}
          .pageName=${this.pageName}
          @infinite-toggle=${this.handleInfiniteToggle}
        ></infinite-scroll-toggle>
      `);
    }

    if (this.settingsHref) {
      sections.push(html`
        <a href=${this.settingsHref} aria-label="Open view preferences">⚙️</a>
      `);
    }

    const row = html`
      <div class="control-row">
        ${sections.length ? this.intersperse(sections) : nothing}
      </div>
    `;

    if (!this.framed) {
      return row;
    }

    return html`<route-shell-card wide compact>${row}</route-shell-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'control-panel': ControlPanel;
  }
}
