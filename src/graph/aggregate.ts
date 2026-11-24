import type { SysEdge, SystemDoc } from '../schema/system';
import { buildTree, type TreeIndex } from './tree';
import { visibleAncestor } from './visibility';

// Edge aggregation (SPEC §5.4): every original edge is lifted to the visible ancestors of its
// ends; edges inside a collapsed node disappear and edges sharing the same ordered pair merge.

export interface RenderedEdge {
  /** Stable id derived from the ordered pair, e.g. `sistema-pedidos->ca-gateway`. */
  id: string;
  source: string;
  target: string;
  /** Original edge ids, in document order. */
  edgeIds: string[];
  /** True when more than one original edge is merged (label shows ×N). */
  aggregated: boolean;
  /** Short label for a single edge: `label`, else `protocol`, else undefined. */
  label: string | undefined;
  /** Dashed line: the single edge is async, or all merged edges are async. */
  async: boolean;
  /** 50% opacity and "(?)": the single edge is assumed, or all merged edges are. */
  assumed: boolean;
}

export function renderedEdgeId(source: string, target: string): string {
  return `${source}->${target}`;
}

export function edgeShortLabel(edge: SysEdge): string | undefined {
  return edge.label ?? edge.protocol;
}

export function aggregateEdges(
  doc: SystemDoc,
  expandedIds: ReadonlySet<string>,
  tree: TreeIndex = buildTree(doc),
): RenderedEdge[] {
  const groups = new Map<string, { source: string; target: string; edges: SysEdge[] }>();
  for (const edge of doc.edges) {
    const source = visibleAncestor(edge.source, tree, expandedIds);
    const target = visibleAncestor(edge.target, tree, expandedIds);
    if (source === target) continue; // internal to a collapsed node
    const id = renderedEdgeId(source, target);
    const group = groups.get(id);
    if (group) group.edges.push(edge);
    else groups.set(id, { source, target, edges: [edge] });
  }

  return Array.from(groups, ([id, { source, target, edges }]) => {
    const single = edges.length === 1 ? edges[0] : undefined;
    return {
      id,
      source,
      target,
      edgeIds: edges.map((e) => e.id),
      aggregated: edges.length > 1,
      label: single ? edgeShortLabel(single) : undefined,
      async: edges.every((e) => e.mode === 'async'),
      assumed: edges.every((e) => e.confidence === 'assumed'),
    };
  });
}
