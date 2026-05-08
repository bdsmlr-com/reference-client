import { LitElement, html, css } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/theme.js';
import type { Blog } from '../types/api.js';
import { EventNames, type WhenChangeDetail } from '../types/events.js';
import {
  formatArchiveWhenLabel,
  getArchiveWhenDays,
  getArchiveWhenMonths,
  getArchiveWhenYears,
  parseArchiveWhenParts,
  resolveArchiveWhenBounds,
} from '../services/archive-when.js';
import { SelectorPopoverController, selectorPopoverStyles } from './selector-popover.js';

type BrowseLevel = 'root' | 'year' | 'month';

@customElement('archive-when-picker')
export class ArchiveWhenPicker extends LitElement {
  static styles = [
    baseStyles,
    selectorPopoverStyles,
    css`
      :host {
        display: block;
      }

      .selector {
        justify-content: center;
      }

      .trigger strong {
        font-weight: 600;
      }

      .popover {
        background: var(--bg-panel);
      }

      .breadcrumbs {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-bottom: 12px;
        color: var(--text-muted);
        font-size: 12px;
      }

      .crumb {
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        padding: 0;
      }

      .crumb[aria-current='true'] {
        color: var(--text-primary);
        font-weight: 600;
      }

      .panel {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .cell {
        min-height: 40px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        font: inherit;
        cursor: pointer;
        padding: 0 8px;
      }

      .cell[data-kind='all'] {
        grid-column: 1 / -1;
        font-weight: 600;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 10px;
      }

      .close {
        min-height: 36px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: var(--bg-panel-alt);
        color: var(--text-primary);
        padding: 0 14px;
        font: inherit;
        cursor: pointer;
      }

      @media (max-width: 600px) {
        .panel {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `,
  ];

  @property({ type: Object }) blog: Blog | null = null;
  @property({ type: String }) value = '';

  @state() private open = false;
  @state() private browseLevel: BrowseLevel = 'root';
  @state() private openYear: number | null = null;
  @state() private openMonth: number | null = null;
  private selectorPopover = new SelectorPopoverController(this, () => this.open, (next) => { this.open = next; });

  connectedCallback(): void {
    super.connectedCallback();
    this.selectorPopover.connect();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.selectorPopover.disconnect();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value')) {
      this.syncSelectionFromValue();
    }
  }

  private syncSelectionFromValue(): void {
    const parts = parseArchiveWhenParts(this.value);
    this.openYear = parts?.year ?? null;
    this.openMonth = parts?.month ?? null;
    if (!parts) {
      this.browseLevel = 'root';
      return;
    }
    this.browseLevel = parts.granularity === 'year' ? 'year' : 'month';
  }

  private emitChange(value: string): void {
    this.dispatchEvent(new CustomEvent<WhenChangeDetail>(EventNames.WHEN_CHANGE, {
      detail: { value },
      bubbles: true,
      composed: true,
    }));
  }

  private togglePicker(event: Event): void {
    this.syncSelectionFromValue();
    this.selectorPopover.toggle(event);
  }

  private setBrowseLevel(level: BrowseLevel): void {
    this.browseLevel = level;
  }

  private selectAllTime(): void {
    this.emitChange('');
    this.closePicker();
  }

  private selectYear(year: number): void {
    this.openYear = year;
    this.openMonth = null;
    this.browseLevel = 'year';
    this.emitChange(String(year));
  }

  private selectMonth(month: number): void {
    if (!this.openYear) return;
    this.openMonth = month;
    this.browseLevel = 'month';
    this.emitChange(`${this.openYear}-${String(month).padStart(2, '0')}`);
  }

  private selectDay(day: number): void {
    if (!this.openYear || !this.openMonth) return;
    this.emitChange(`${this.openYear}-${String(this.openMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    this.closePicker();
  }

  private closePicker(): void {
    this.selectorPopover.close();
  }

  private renderBreadcrumbs() {
    const parts = parseArchiveWhenParts(this.value);
    const crumbs = [];
    crumbs.push(html`
      <button type="button" class="crumb" aria-current=${parts ? 'false' : 'true'} @click=${() => this.setBrowseLevel('root')}>All time</button>
    `);
    if (parts?.year) {
      crumbs.push(html`<span>›</span>`);
      crumbs.push(html`
        <button type="button" class="crumb" aria-current=${this.browseLevel === 'year' ? 'true' : 'false'} @click=${() => this.setBrowseLevel('year')}>
          ${parts.year}
        </button>
      `);
    }
    if (parts?.month) {
      crumbs.push(html`<span>›</span>`);
      crumbs.push(html`
        <button type="button" class="crumb" aria-current=${this.browseLevel === 'month' ? 'true' : 'false'} @click=${() => this.setBrowseLevel('month')}>
          ${String(parts.month).padStart(2, '0')}
        </button>
      `);
    }
    if (parts?.day) {
      crumbs.push(html`<span>›</span>`);
      crumbs.push(html`
        <span aria-current="true">${String(parts.day).padStart(2, '0')}</span>
      `);
    }
    return crumbs;
  }

  private renderPanel() {
    const bounds = resolveArchiveWhenBounds(this.blog || undefined);
    const parts = parseArchiveWhenParts(this.value);
    const year = parts?.year ?? this.openYear;
    const month = parts?.month ?? this.openMonth;

    if (this.browseLevel === 'root' || !year) {
      return html`
        <button type="button" class="cell" data-kind="all" @click=${() => this.selectAllTime()}>All time</button>
        ${getArchiveWhenYears(bounds).map((value) => html`
          <button type="button" class="cell" @click=${() => this.selectYear(value)}>${value}</button>
        `)}
      `;
    }

    if (this.browseLevel === 'year' || !month) {
      return html`
        ${getArchiveWhenMonths(year, bounds).map((value) => html`
          <button type="button" class="cell" @click=${() => this.selectMonth(value)}>${String(value).padStart(2, '0')}</button>
        `)}
      `;
    }

    return html`
      ${getArchiveWhenDays(year, month, bounds).map((value) => html`
        <button type="button" class="cell" @click=${() => this.selectDay(value)}>${String(value).padStart(2, '0')}</button>
      `)}
    `;
  }

  render() {
    return html`
      <div class="selector">
        <button
          class="trigger ${this.open || this.value ? 'active' : ''}"
          type="button"
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          @click=${this.togglePicker}
        >
          <strong>${formatArchiveWhenLabel(this.value)}</strong>
        </button>
        ${this.open ? html`
          <div class="popover" role="dialog" aria-label="Choose archive date" @click=${this.selectorPopover.stopPropagation}>
            <div class="breadcrumbs">
              ${this.renderBreadcrumbs()}
            </div>
            <div class="panel">
              ${this.renderPanel()}
            </div>
            <div class="actions">
              <button class="close" type="button" @click=${() => this.closePicker()}>Close</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'archive-when-picker': ArchiveWhenPicker;
  }
}
