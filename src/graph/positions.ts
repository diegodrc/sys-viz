import type { Position, SystemDoc } from '../schema/system';
import { buildTree } from './tree';

// Saved node positions (SPEC §4.1 layout.positions, §5.5, §6.2). Positions are relative to the
// parent's top-left corner (or to the canvas for root nodes). All functions are pure.

export type Positions = Record<string, Position>;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Padding {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** Group padding used by ELK and by the bounding-box recomputation (SPEC §5.5). */
export const GROUP_PADDING: Readonly<Padding> = { top: 48, left: 24, bottom: 24, right: 24 };

export function positionsOf(doc: SystemDoc): Positions {
  return doc.layout?.positions ?? {};
}

function withPositions(doc: SystemDoc, positions: Positions): SystemDoc {
  return { ...doc, layout: { ...doc.layout, positions } };
}

/**
 * "Substituir" on import (SPEC §6.2): keep the old document's positions for node ids that still
 * exist; positions present in the incoming document win.
 */
export function mergePositionsOnReplace(previous: SystemDoc, incoming: SystemDoc): SystemDoc {
  const nodeIds = new Set(buildTree(incoming).order);
  const merged: Positions = {};
  for (const [id, position] of Object.entries(positionsOf(previous))) {
    if (nodeIds.has(id)) merged[id] = position;
  }
  for (const [id, position] of Object.entries(positionsOf(incoming))) {
    if (nodeIds.has(id)) merged[id] = position;
  }
  if (Object.keys(merged).length === 0 && !incoming.layout) return incoming;
  return withPositions(incoming, merged);
}

export function setPositions(doc: SystemDoc, updates: Positions): SystemDoc {
  return withPositions(doc, { ...positionsOf(doc), ...updates });
}

/** "Resetar layout" (SPEC §5.5): empties layout.positions. */
export function resetPositions(doc: SystemDoc): SystemDoc {
  return withPositions(doc, {});
}

export interface GroupFit {
  /** The group's new box, relative to its own parent. */
  group: Box;
  /** New child positions, relative to the group, for every child. */
  children: Positions;
  /** True when the group origin moved to keep children inside the padding. */
  shifted: boolean;
}

/**
 * Recomputes a group's box around its children after a drag (SPEC §5.5). If a child sits left of
 * / above the padding (even negative), the group origin moves up/left and every child is shifted
 * by the same amount so that nothing moves on screen. Callers cascade this to ancestors.
 */
export function fitGroupToChildren(
  group: Box,
  children: Readonly<Record<string, Box>>,
  padding: Readonly<Padding> = GROUP_PADDING,
): GroupFit {
  const boxes = Object.entries(children);
  if (boxes.length === 0) {
    return { group, children: {}, shifted: false };
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const [, box] of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
  }
  const dx = Math.max(0, padding.left - minX);
  const dy = Math.max(0, padding.top - minY);

  const moved: Positions = {};
  let maxRight = 0;
  let maxBottom = 0;
  for (const [id, box] of boxes) {
    const x = box.x + dx;
    const y = box.y + dy;
    moved[id] = { x, y };
    maxRight = Math.max(maxRight, x + box.width);
    maxBottom = Math.max(maxBottom, y + box.height);
  }

  return {
    group: {
      x: group.x - dx,
      y: group.y - dy,
      width: maxRight + padding.right,
      height: maxBottom + padding.bottom,
    },
    children: moved,
    shifted: dx > 0 || dy > 0,
  };
}
