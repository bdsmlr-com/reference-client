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

type PlacementCandidate = { left: number; top: number; score: number };

function getPlacedBounds(placed: PositionedArchiveTag[]): { left: number; top: number; right: number; bottom: number } | null {
  if (placed.length === 0) return null;
  return {
    left: Math.min(...placed.map((item) => item.left)),
    top: Math.min(...placed.map((item) => item.top)),
    right: Math.max(...placed.map((item) => item.left + item.boxWidth)),
    bottom: Math.max(...placed.map((item) => item.top + item.boxHeight)),
  };
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
  const placedBounds = getPlacedBounds(placed);
  const anchorX = placedBounds ? (placedBounds.left + placedBounds.right) / 2 : centerX;
  const anchorY = placedBounds ? (placedBounds.top + placedBounds.bottom) / 2 : centerY;
  const clusterArea = placedBounds
    ? Math.max(1, (placedBounds.right - placedBounds.left) * (placedBounds.bottom - placedBounds.top))
    : 1;
  const maxExpansion = Math.sqrt(clusterArea) * 0.55 + 26;
  let bestCandidate: PlacementCandidate | null = null;

  const scoreCandidate = (left: number, top: number): number => {
    const candidateCenterX = left + boxWidth / 2;
    const candidateCenterY = top + boxHeight / 2;
    const distance = Math.hypot(candidateCenterX - anchorX, candidateCenterY - anchorY);
    if (!placedBounds) return distance;

    const nextLeft = Math.min(placedBounds.left, left);
    const nextTop = Math.min(placedBounds.top, top);
    const nextRight = Math.max(placedBounds.right, left + boxWidth);
    const nextBottom = Math.max(placedBounds.bottom, top + boxHeight);
    const expandX = Math.max(0, nextRight - nextLeft - (placedBounds.right - placedBounds.left));
    const expandY = Math.max(0, nextBottom - nextTop - (placedBounds.bottom - placedBounds.top));
    const expansionPenalty = expandX + expandY;
    const detachedPenalty = distance > maxExpansion ? (distance - maxExpansion) * 8 : 0;
    return distance + expansionPenalty * 2.5 + detachedPenalty;
  };

  const considerCandidate = (left: number, top: number): { left: number; top: number } | null => {
    const overlaps = placed.some((item) =>
      intersects(
        { left, top, width: boxWidth, height: boxHeight },
        { left: item.left, top: item.top, width: item.boxWidth, height: item.boxHeight },
        gap,
      ),
    );
    if (overlaps) {
      return null;
    }
    const score = scoreCandidate(left, top);
    if (!bestCandidate || score < bestCandidate.score) {
      bestCandidate = { left, top, score };
    }
    return { left, top };
  };

  const bestPlacement = (): { left: number; top: number } | null => (
    bestCandidate ? { left: bestCandidate.left, top: bestCandidate.top } : null
  );
  const bestPlacementScore = (candidate: PlacementCandidate | null): number => (
    candidate ? candidate.score : Number.POSITIVE_INFINITY
  );

  for (let step = 0; step < 2200; step += 1) {
    const angle = step * 0.34;
    const radius = 2 + 3.2 * Math.sqrt(step);
    const left = Math.round(anchorX + Math.cos(angle) * radius - boxWidth / 2);
    const top = Math.round(anchorY + Math.sin(angle) * radius - boxHeight / 2);
    if (left < 0 || top < 0 || left + boxWidth > width || top + boxHeight > height) {
      continue;
    }
    if (considerCandidate(left, top) && placed.length === 0) {
      return { left, top };
    }
    const candidateScore = bestPlacementScore(bestCandidate);
    if (step > 96 && candidateScore < 120) {
      return bestPlacement();
    }
  }

  if (bestCandidate) {
    return bestPlacement();
  }

  const stride = Math.max(6, Math.floor(gap));
  for (let top = 0; top <= height - boxHeight; top += stride) {
    for (let left = 0; left <= width - boxWidth; left += stride) {
      considerCandidate(left, top);
    }
  }
  return bestPlacement();
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
