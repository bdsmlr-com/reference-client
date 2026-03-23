import type { RenderContractConfig } from '../config';

export interface RenderContractValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateRenderContract(contract: RenderContractConfig): RenderContractValidationResult {
  const errors: string[] = [];

  if (!contract.pages || !contract.cards || !contract.elements || !contract.interactions) {
    errors.push('render contract missing top-level sections');
    return { ok: false, errors };
  }

  for (const [pageId, page] of Object.entries(contract.pages)) {
    if (!page.slots) {
      errors.push(`page ${pageId} missing slots`);
      continue;
    }

    for (const [slotId, slot] of Object.entries(page.slots)) {
      if (!Array.isArray(slot.cards) || slot.cards.length === 0) {
        errors.push(`page ${pageId} slot ${slotId} missing cards`);
        continue;
      }

      for (const cardId of slot.cards) {
        const card = contract.cards[cardId];
        if (!card) {
          errors.push(`page ${pageId} slot ${slotId} references missing card ${cardId}`);
          continue;
        }
        if (!card.regions || Object.keys(card.regions).length === 0) {
          errors.push(`card ${cardId} missing regions`);
        }
        if (slot.async && !card.skeleton) {
          errors.push(`async slot ${pageId}.${slotId} card ${cardId} missing skeleton`);
        }
      }

      if (slot.loading && !contract.cards[slot.loading.cardType]) {
        errors.push(`slot ${pageId}.${slotId} loading card missing: ${slot.loading.cardType}`);
      }
    }
  }

  for (const [elementId, element] of Object.entries(contract.elements)) {
    if (!element.visibility_rules) {
      errors.push(`element ${elementId} missing visibility_rules`);
    }
  }

  for (const [interactionId, interaction] of Object.entries(contract.interactions)) {
    if (!interaction.zone) {
      errors.push(`interaction ${interactionId} missing zone`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
