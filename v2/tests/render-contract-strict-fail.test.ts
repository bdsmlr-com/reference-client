import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRenderContract } from '../src/services/render-contract-validator';

describe('render contract strict fail', () => {
  it('fails when page references missing card', () => {
    const result = validateRenderContract({
      pages: {
        archive: {
          slots: {
            main_stream: {
              cards: ['missing_card'],
              async: true,
              loading: { cardType: 'missing_card', count: 12 },
            },
          },
        },
      },
      cards: {},
      elements: {},
      interactions: {},
    } as any);

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('app-root contains strict contract error render path', () => {
    const src = readFileSync(join(process.cwd(), 'src/app-root.ts'), 'utf8');
    expect(src).toContain('contract-error-screen');
    expect(src).toContain('validateRenderContract');
  });
});
