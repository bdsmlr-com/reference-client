import type { Tag } from '../types/api.js';

export interface MeasuredArchiveTag extends Tag {
  fontSize: number;
  width: number;
  height: number;
}

export interface PositionedArchiveTag extends MeasuredArchiveTag {
  left: number;
  top: number;
  rotated: boolean;
  boxWidth: number;
  boxHeight: number;
}

export interface ArchiveTagLayout {
  items: PositionedArchiveTag[];
  width: number;
  height: number;
}

interface LayoutOptions {
  width: number;
  maxHeight: number;
  gap?: number;
  padding?: number;
  allowRotation?: boolean;
}

function intersects(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
  gap: number,
): boolean {
  return !(
    a.left + a.width + gap <= b.left ||
    b.left + b.width + gap <= a.left ||
    a.top + a.height + gap <= b.top ||
    b.top + b.height + gap <= a.top
  );
}

function chooseRotation(tag: MeasuredArchiveTag, index: number, allowRotation: boolean): boolean {
  if (!allowRotation) {
    return false;
  }
  const wide = tag.width > tag.height * 2.2;
  return wide && index % 4 === 1;
}

function placeTag(
  width: number,
  height: number,
  placed: PositionedArchiveTag[],
  boxWidth: number,
  boxHeight: number,
  gap: number,
): { left: number; top: number } | null {
  const centerX = width / 2;
  const centerY = height / 2;
  for (let step = 0; step < 2200; step += 1) {
    const angle = step * 0.34;
    const radius = 2 + 3.2 * Math.sqrt(step);
    const left = Math.round(centerX + Math.cos(angle) * radius - boxWidth / 2);
    const top = Math.round(centerY + Math.sin(angle) * radius - boxHeight / 2);
    if (left < 0 || top < 0 || left + boxWidth > width || top + boxHeight > height) {
      continue;
    }
    const overlaps = placed.some((item) =>
      intersects(
        { left, top, width: boxWidth, height: boxHeight },
        { left: item.left, top: item.top, width: item.boxWidth, height: item.boxHeight },
        gap,
      ),
    );
    if (!overlaps) {
      return { left, top };
    }
  }

  const stride = Math.max(6, Math.floor(gap));
  for (let top = 0; top <= height - boxHeight; top += stride) {
    for (let left = 0; left <= width - boxWidth; left += stride) {
      const overlaps = placed.some((item) =>
        intersects(
          { left, top, width: boxWidth, height: boxHeight },
          { left: item.left, top: item.top, width: item.boxWidth, height: item.boxHeight },
          gap,
        ),
      );
      if (!overlaps) {
        return { left, top };
      }
    }
  }
  return null;
}

export function buildArchiveTagLayout(
  measuredTags: MeasuredArchiveTag[],
  options: LayoutOptions,
): ArchiveTagLayout {
  const gap = options.gap ?? 8;
  const padding = options.padding ?? 12;
  const boundedWidth = Math.max(240, Math.floor(options.width));
  const boundedHeight = Math.max(220, Math.floor(options.maxHeight));
  const innerWidth = Math.max(160, boundedWidth - padding * 2);
  const innerHeight = Math.max(160, boundedHeight - padding * 2);

  const sorted = [...measuredTags].sort((a, b) => (b.postsCount || 0) - (a.postsCount || 0));
  const placed: PositionedArchiveTag[] = [];

  sorted.forEach((tag, index) => {
    const rotated = chooseRotation(tag, index, options.allowRotation ?? true);
    const boxWidth = Math.ceil(rotated ? tag.height : tag.width);
    const boxHeight = Math.ceil(rotated ? tag.width : tag.height);
    const spot = placeTag(innerWidth, innerHeight, placed, boxWidth, boxHeight, gap);
    if (!spot) {
      return;
    }
    placed.push({
      ...tag,
      rotated,
      left: spot.left,
      top: spot.top,
      boxWidth,
      boxHeight,
    });
  });

  if (placed.length === 0) {
    return { items: [], width: boundedWidth, height: 0 };
  }

  const minLeft = Math.min(...placed.map((item) => item.left));
  const minTop = Math.min(...placed.map((item) => item.top));
  const maxRight = Math.max(...placed.map((item) => item.left + item.boxWidth));
  const maxBottom = Math.max(...placed.map((item) => item.top + item.boxHeight));
  const occupiedWidth = maxRight - minLeft;
  const occupiedHeight = maxBottom - minTop;
  const horizontalInset = Math.max(padding, Math.round((boundedWidth - occupiedWidth) / 2));
  const verticalInset = padding;

  return {
    width: boundedWidth,
    height: occupiedHeight + verticalInset * 2,
    items: placed.map((item) => ({
      ...item,
      left: item.left - minLeft + horizontalInset,
      top: item.top - minTop + verticalInset,
    })),
  };
}
