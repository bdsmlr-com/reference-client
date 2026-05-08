import { css } from 'lit';

export const selectorPopoverStyles = css`
  :host {
    display: inline-flex;
    position: relative;
    min-width: 0;
  }

  .selector {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-width: 0;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--bg-panel-alt);
    color: var(--text-primary);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
  }

  .trigger:hover {
    background: var(--border-strong);
  }

  .trigger.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .trigger-summary {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .popover {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    width: min(92vw, 420px);
    padding: 12px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--surface-raised, var(--surface-primary, #fff));
    box-shadow: 0 18px 45px rgba(0, 0, 0, 0.12);
    z-index: 30;
  }

  .pill-group {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
  }
`;

export class SelectorPopoverController {
  constructor(
    private readonly host: HTMLElement,
    private readonly isOpen: () => boolean,
    private readonly setOpen: (next: boolean) => void,
  ) {}

  connect(): void {
    window.addEventListener('click', this.handleWindowClick);
  }

  disconnect(): void {
    window.removeEventListener('click', this.handleWindowClick);
  }

  toggle = (event: Event): void => {
    event.stopPropagation();
    this.setOpen(!this.isOpen());
  };

  close = (): void => {
    this.setOpen(false);
  };

  stopPropagation = (event: Event): void => {
    event.stopPropagation();
  };

  private handleWindowClick = (event: Event): void => {
    if (!this.isOpen()) return;
    if (!event.composedPath().includes(this.host)) {
      this.setOpen(false);
    }
  };
}
