import type { RenderSlotConfig } from '../config.js';
import { loadRenderContract } from './render-contract.js';

export function getPageSlotConfig(pageId: string, slotId: string): RenderSlotConfig {
  const contract = loadRenderContract();
  const page = contract.pages[pageId];
  if (!page) {
    throw new Error(`Render contract page not found: ${pageId}`);
  }

  const slot = page.slots[slotId];
  if (!slot) {
    throw new Error(`Render contract slot not found: ${pageId}.${slotId}`);
  }

  return slot;
}
