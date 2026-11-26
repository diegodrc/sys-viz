import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import type { Box } from './positions';

// Orthogonal edge routes computed by ELK (DECISIONS 2026-11-25: they replace the SPEC §5.5
// `smoothstep` drawing so edges avoid overlapping). Pure.

export interface Point {
  x: number;
  y: number;
}

/** ELK route of one rendered edge, in absolute (root) coordinates. */
export interface EdgeRoute {
  points: Point[];
  /** Absolute boxes of the edge ends when the route was computed: the route is only valid while
   * both ends are still there (a drag or a saved position invalidates it). */
  source: Box;
  target: Box;
}

export type EdgeRoutes = Record<string, EdgeRoute>;

/** Absolute boxes of every node of an ELK result (shape coordinates are parent-relative). */
function absoluteBoxes(result: ElkNode): Map<string, Box> {
  const out = new Map<string, Box>();
  const stack: { node: ElkNode; dx: number; dy: number }[] = (result.children ?? []).map(
    (node) => ({ node, dx: 0, dy: 0 }),
  );
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    const { node, dx, dy } = item;
    const x = dx + (node.x ?? 0);
    const y = dy + (node.y ?? 0);
    out.set(node.id, { x, y, width: node.width ?? 0, height: node.height ?? 0 });
    for (const child of node.children ?? []) stack.push({ node: child, dx: x, dy: y });
  }
  return out;
}

function allEdges(result: ElkNode): ElkExtendedEdge[] {
  const edges: ElkExtendedEdge[] = [];
  const stack: ElkNode[] = [result];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    edges.push(...(node.edges ?? []));
    stack.push(...(node.children ?? []));
  }
  return edges;
}

/**
 * Routes from an ELK result laid out with `elk.json.edgeCoords: ROOT` (edge sections in root
 * coordinates). Sections are chained in order; consecutive duplicate points are dropped.
 */
export function readElkRoutes(result: ElkNode): EdgeRoutes {
  const boxes = absoluteBoxes(result);
  const routes: EdgeRoutes = {};
  for (const edge of allEdges(result)) {
    const source = boxes.get(edge.sources[0] ?? '');
    const target = boxes.get(edge.targets[0] ?? '');
    const sections = edge.sections ?? [];
    if (!source || !target || sections.length === 0) continue;
    const points: Point[] = [];
    for (const section of sections) {
      for (const p of [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]) {
        const last = points[points.length - 1];
        if (!last || last.x !== p.x || last.y !== p.y) points.push({ x: p.x, y: p.y });
      }
    }
    if (points.length >= 2) routes[edge.id] = { points, source, target };
  }
  return routes;
}

const TOLERANCE = 0.5;

function sameBox(a: Box, b: Box): boolean {
  return (
    Math.abs(a.x - b.x) <= TOLERANCE &&
    Math.abs(a.y - b.y) <= TOLERANCE &&
    Math.abs(a.width - b.width) <= TOLERANCE &&
    Math.abs(a.height - b.height) <= TOLERANCE
  );
}

/** True while both ends are where ELK placed them (otherwise draw the fallback path). */
export function routeStillValid(route: EdgeRoute, source: Box, target: Box): boolean {
  return sameBox(route.source, source) && sameBox(route.target, target);
}

/** SVG path through the points with rounded corners (radius clamped to half of each segment). */
export function roundedPath(points: readonly Point[], radius = 8): string {
  const first = points[0];
  if (!first) return '';
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (!p) break;
    const prev = points[i - 1] ?? p;
    const next = points[i + 1];
    if (!next) {
      d += ` L ${p.x} ${p.y}`;
      break;
    }
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y);
    const outLen = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r <= 0) {
      d += ` L ${p.x} ${p.y}`;
      continue;
    }
    const before = { x: p.x + ((prev.x - p.x) / inLen) * r, y: p.y + ((prev.y - p.y) / inLen) * r };
    const after = {
      x: p.x + ((next.x - p.x) / outLen) * r,
      y: p.y + ((next.y - p.y) / outLen) * r,
    };
    d += ` L ${before.x} ${before.y} Q ${p.x} ${p.y} ${after.x} ${after.y}`;
  }
  return d;
}

/** Point halfway along the polyline (where the edge label goes). */
export function midpoint(points: readonly Point[]): Point {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  let remaining = total / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len >= remaining && len > 0) {
      const k = remaining / len;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    remaining -= len;
  }
  return points[0] ?? { x: 0, y: 0 };
}
