import { describe, it, expect } from 'vitest';
import mediaConfig from '../media-config.json';
import { loadRenderContract } from '../src/services/render-contract';
import { validateRenderContract } from '../src/services/render-contract-validator';

describe('render contract schema', () => {
  it('defines pages, cards, elements, and interactions', () => {
    const render = (mediaConfig as any).render;
    expect(render).toBeDefined();
    expect(render.pages).toBeDefined();
    expect(render.cards).toBeDefined();
    expect(render.elements).toBeDefined();
    expect(render.interactions).toBeDefined();
  });

  it('loads typed render contract from config', () => {
    const contract = loadRenderContract();
    expect(contract.pages).toBeDefined();
    expect(contract.cards).toBeDefined();
  });

  it('supports region/mode schema and element/interaction requirements', () => {
    const result = validateRenderContract({
      pages: {
        archive: {
          slots: {
            main_stream: {
              cards: ['post_grid'],
            },
          },
        },
      },
      cards: {
        post_grid: {
          layout: 'grid',
          elements: [],
          regions: { media: ['media_main'] },
          mode_overrides: {
            regular: { region_order: ['media', 'meta'] },
            admin: { region_order: ['header', 'badges', 'media'] },
          },
        },
      },
      elements: {
        media_main: {
          primitive: 'media',
          visibility_rules: { modes: ['regular', 'admin'] },
        },
      },
      interactions: {
        open_lightbox_post: {
          type: 'open_lightbox',
          zone: 'media',
        },
      },
    } as any);
    expect(result.ok).toBe(true);
  });

  it('defines approved polymorphic pages and card ids', () => {
    const render = (mediaConfig as any).render;
    expect(render.pages.post).toBeDefined();
    expect(render.cards.gallery_card).toBeDefined();
    expect(render.cards.timeline_full_card).toBeDefined();
    expect(render.cards.activity_matrix_card).toBeDefined();
    expect(render.cards.lightbox_card).toBeDefined();
    expect(render.cards.post_detail_card).toBeDefined();
    expect(render.cards.social_list_card).toBeDefined();
  });
});
