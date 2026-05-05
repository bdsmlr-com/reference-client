import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { Blog, PostType, PostVariant } from '../types/api.js';
import type { ActivityKind } from '../services/profile.js';
import './activity-kind-pills.js';
import './archive-when-picker.js';
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
  @property({ type: Array }) selectedTypes: PostType[] = [];
  @property({ type: Array }) selectedVariants: PostVariant[] = [];
  @property({ type: Array }) activityKinds: ActivityKind[] = [];
  @property({ type: String }) whenValue = '';
  @property({ type: Object }) blog: Blog | null = null;
  @property({ type: String }) pageName = '';
  @property({ type: Boolean }) showSort = false;
  @property({ type: Boolean }) showTypes = false;
  @property({ type: Boolean }) showVariants = false;
  @property({ type: Boolean }) showActivityKinds = false;
  @property({ type: Boolean }) showWhen = false;
  @property({ type: Boolean }) loading = false;

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

  private intersperse(parts: TemplateResult[]): TemplateResult[] {
    return parts.flatMap((part, index) => (
      index === 0 ? [part] : [html`<span class="separator" aria-hidden="true">|</span>`, part]
    ));
  }

  render() {
    const sections: TemplateResult[] = [];

    if (this.showSort) {
      sections.push(html`
        <sort-controls .value=${this.sortValue} @sort-change=${this.handleSortChange}></sort-controls>
      `);
    }

    if (this.showActivityKinds) {
      sections.push(html`
        <activity-kind-pills .selected=${this.activityKinds} @activity-kinds-change=${this.handleActivityKindsChange}></activity-kind-pills>
      `);
    }

    if (this.showTypes) {
      sections.push(html`
        <type-pills .selectedTypes=${this.selectedTypes} @types-change=${this.handleTypesChange}></type-pills>
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

    return html`
      <div class="control-row">
        ${sections.length ? this.intersperse(sections) : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'control-panel': ControlPanel;
  }
}
