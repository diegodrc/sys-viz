import { describe, expect, it } from 'vitest';
import { createDirectEngine } from '../layout/engine';
import { exampleDoc } from '../test/fixtures';
import { aggregateEdges } from './aggregate';
import { midpoint, readElkRoutes, roundedPath, routeStillValid, type Point } from './edgeRoute';
import { applySavedPositions, buildElkGraph, readElkLayout } from './layout';
import type { Box } from './positions';
import { buildTree } from './tree';
import { expandAll } from './visibility';

const doc = exampleDoc();
const tree = buildTree(doc);

function onBorder(p: Point, box: Box): boolean {
  const eps = 1;
  const insideX = p.x >= box.x - eps && p.x <= box.x + box.width + eps;
  const insideY = p.y >= box.y - eps && p.y <= box.y + box.height + eps;
  const onVertical = Math.abs(p.x - box.x) <= eps || Math.abs(p.x - box.x - box.width) <= eps;
  const onHorizontal = Math.abs(p.y - box.y) <= eps || Math.abs(p.y - box.y - box.height) <= eps;
  return insideX && insideY && (onVertical || onHorizontal);
}

/** Absolute boxes from parent-relative ones. */
function absolute(boxes: Record<string, Box>): Record<string, Box> {
  const out: Record<string, Box> = {};
  for (const [id, box] of Object.entries(boxes)) {
    let { x, y } = box;
    for (const ancestor of tree.ancestorsOf(id)) {
      const a = boxes[ancestor];
      x += a?.x ?? 0;
      y += a?.y ?? 0;
    }
    out[id] = { ...box, x, y };
  }
  return out;
}

describe('readElkRoutes (ELK routes in root coordinates)', () => {
  it('fully expanded example: every rendered edge has an orthogonal route between its ends', async () => {
    const expanded = expandAll(tree);
    const rendered = aggregateEdges(doc, expanded, tree);
    const result = await createDirectEngine()(buildElkGraph(tree, expanded, rendered));
    const routes = readElkRoutes(result);
    const boxes = absolute(applySavedPositions(readElkLayout(result), {}, tree, expanded));

    expect(Object.keys(routes).sort()).toEqual(rendered.map((e) => e.id).sort());
    for (const edge of rendered) {
      const route = routes[edge.id];
      const source = boxes[edge.source];
      const target = boxes[edge.target];
      if (!route || !source || !target) throw new Error(edge.id);
      expect(onBorder(route.points[0]!, source)).toBe(true);
      expect(onBorder(route.points[route.points.length - 1]!, target)).toBe(true);
      // orthogonal: every segment is horizontal or vertical
      for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1]!;
        const b = route.points[i]!;
        expect(Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5).toBe(true);
      }
      // without saved positions the route stays valid for the boxes the canvas draws
      expect(routeStillValid(route, source, target)).toBe(true);
    }
  });

  it('a moved end invalidates the route', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const route = { points: [], source: box, target: box };
    expect(routeStillValid(route, box, box)).toBe(true);
    expect(routeStillValid(route, { ...box, x: 5 }, box)).toBe(false);
  });
});

describe('roundedPath / midpoint', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
  ];

  it('rounds corners with a quadratic curve and ends on the last point', () => {
    expect(roundedPath(points, 8)).toBe('M 0 0 L 92 0 Q 100 0 100 8 L 100 50');
    expect(roundedPath([])).toBe('');
  });

  it('midpoint is halfway along the polyline', () => {
    expect(midpoint(points)).toEqual({ x: 75, y: 0 });
  });
});
