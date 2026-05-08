import { describe, expect, it } from 'vitest';
import { buildArchiveTagLayout, type MeasuredArchiveTag } from '../src/services/archive-tag-layout.js';

function makeTag(name: string, postsCount: number, fontSize: number, width: number, height: number): MeasuredArchiveTag {
  return { name, postsCount, fontSize, width, height };
}

describe('archive tag layout', () => {
  it('packs tags without overlapping boxes', () => {
    const layout = buildArchiveTagLayout(
      [
        makeTag('latex', 50, 34, 120, 34),
        makeTag('bikini', 40, 30, 132, 30),
        makeTag('ddlg', 35, 28, 92, 28),
        makeTag('outside', 20, 22, 110, 22),
        makeTag('pigtails', 18, 20, 118, 20),
      ],
      { width: 640, maxHeight: 420, allowRotation: true },
    );

    expect(layout.items.length).toBe(5);
    for (let i = 0; i < layout.items.length; i += 1) {
      const a = layout.items[i];
      expect(a.left).toBeGreaterThanOrEqual(0);
      expect(a.top).toBeGreaterThanOrEqual(0);
      expect(a.left + a.boxWidth).toBeLessThanOrEqual(layout.width);
      expect(a.top + a.boxHeight).toBeLessThanOrEqual(layout.height);
      for (let j = i + 1; j < layout.items.length; j += 1) {
        const b = layout.items[j];
        const overlap = !(
          a.left + a.boxWidth <= b.left ||
          b.left + b.boxWidth <= a.left ||
          a.top + a.boxHeight <= b.top ||
          b.top + b.boxHeight <= a.top
        );
        expect(overlap).toBe(false);
      }
    }
  });

  it('rotates some wide tags when rotation is enabled', () => {
    const layout = buildArchiveTagLayout(
      [
        makeTag('dominant male esthete', 100, 34, 320, 34),
        makeTag('Germany', 80, 28, 130, 28),
        makeTag('successful white male', 60, 24, 260, 24),
        makeTag('aesthetes', 40, 20, 120, 20),
        makeTag('cute and soft', 35, 18, 150, 18),
      ],
      { width: 700, maxHeight: 500, allowRotation: true },
    );

    expect(layout.items.some((item) => item.rotated)).toBe(true);
  });
});
