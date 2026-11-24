import { describe, expect, it } from 'vitest';
import type { SystemDoc } from '../schema/system';
import { exampleDoc } from '../test/fixtures';
import {
  GROUP_PADDING,
  fitGroupToChildren,
  mergePositionsOnReplace,
  resetPositions,
  setPositions,
  type Box,
} from './positions';

function withLayout(doc: SystemDoc, positions: SystemDoc['layout']): SystemDoc {
  return { ...doc, layout: positions };
}

describe('mergePositionsOnReplace (SPEC §6.2)', () => {
  const previous = withLayout(exampleDoc(), {
    positions: { apigee: { x: 10, y: 20 }, akamai: { x: 1, y: 1 }, removed: { x: 5, y: 5 } },
  });

  it('keeps positions of remaining ids and drops removed ids', () => {
    const incoming = exampleDoc();
    const merged = mergePositionsOnReplace(previous, incoming);
    expect(merged.layout?.positions).toEqual({ apigee: { x: 10, y: 20 }, akamai: { x: 1, y: 1 } });
  });

  it('positions from the imported JSON take precedence', () => {
    const incoming = withLayout(exampleDoc(), { positions: { apigee: { x: 99, y: 99 } } });
    const merged = mergePositionsOnReplace(previous, incoming);
    expect(merged.layout?.positions).toEqual({ apigee: { x: 99, y: 99 }, akamai: { x: 1, y: 1 } });
  });

  it('drops a node removed from the incoming document', () => {
    const incoming = exampleDoc();
    incoming.nodes = incoming.nodes.filter((n) => n.id !== 'apigee');
    const merged = mergePositionsOnReplace(previous, incoming);
    expect(merged.layout?.positions).toEqual({ akamai: { x: 1, y: 1 } });
  });

  it('returns the incoming document untouched when there is nothing to merge', () => {
    const incoming = exampleDoc();
    expect(mergePositionsOnReplace(exampleDoc(), incoming)).toBe(incoming);
  });

  it('does not mutate either document', () => {
    const incoming = withLayout(exampleDoc(), { positions: { apigee: { x: 99, y: 99 } } });
    const before = [JSON.stringify(previous), JSON.stringify(incoming)];
    mergePositionsOnReplace(previous, incoming);
    expect([JSON.stringify(previous), JSON.stringify(incoming)]).toEqual(before);
  });
});

describe('setPositions / resetPositions', () => {
  it('A9/A10: saving and resetting positions', () => {
    const saved = setPositions(exampleDoc(), { apigee: { x: 3, y: 4 } });
    expect(saved.layout?.positions).toEqual({ apigee: { x: 3, y: 4 } });
    expect(resetPositions(saved).layout?.positions).toEqual({});
  });
});

describe('fitGroupToChildren (SPEC §5.5)', () => {
  const group: Box = { x: 100, y: 100, width: 300, height: 200 };
  const card = { width: 220, height: 64 };

  it('wraps children with padding and keeps the origin when they are inside', () => {
    const fit = fitGroupToChildren(group, {
      a: { x: 24, y: 48, ...card },
      b: { x: 300, y: 150, ...card },
    });
    expect(fit.shifted).toBe(false);
    expect(fit.group).toEqual({
      x: 100,
      y: 100,
      width: 300 + 220 + GROUP_PADDING.right,
      height: 150 + 64 + GROUP_PADDING.bottom,
    });
    expect(fit.children).toEqual({ a: { x: 24, y: 48 }, b: { x: 300, y: 150 } });
  });

  it('shifts the origin and compensates every child when one is dragged above/left', () => {
    const children = {
      dragged: { x: -50, y: 10, ...card },
      other: { x: 60, y: 80, ...card },
    };
    const fit = fitGroupToChildren(group, children);
    const dx = GROUP_PADDING.left + 50;
    const dy = GROUP_PADDING.top - 10;
    expect(fit.shifted).toBe(true);
    expect(fit.group.x).toBe(100 - dx);
    expect(fit.group.y).toBe(100 - dy);
    // absolute positions are unchanged: group origin + child offset stays the same
    for (const [id, before] of Object.entries(children)) {
      const after = fit.children[id];
      expect(fit.group.x + (after?.x ?? NaN)).toBe(group.x + before.x);
      expect(fit.group.y + (after?.y ?? NaN)).toBe(group.y + before.y);
    }
    expect(fit.children.dragged).toEqual({ x: GROUP_PADDING.left, y: GROUP_PADDING.top });
  });

  it('a group with no children keeps its box', () => {
    expect(fitGroupToChildren(group, {})).toEqual({ group, children: {}, shifted: false });
  });
});
