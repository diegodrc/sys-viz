import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { RenderedEdge } from '../../graph/aggregate';
import type { Boxes } from '../../graph/layout';
import type { TreeIndex } from '../../graph/tree';
import { isExpandedGroup, visibleNodeIds } from '../../graph/visibility';
import { t } from '../../i18n/pt-BR';
import type { Hosting, NodeType, SysEdge } from '../../schema/system';

// Converts document + expansion + layout into React Flow nodes and edges. Pure (no React).

export interface SysNodeData extends Record<string, unknown> {
  name: string;
  type: NodeType;
  technology: string | undefined;
  hosting: Hosting | undefined;
  assumed: boolean;
  /** Total descendants (badge "+N" on collapsed groups). */
  descendantCount: number;
  isGroup: boolean;
}

export type SysFlowNode = Node<SysNodeData, 'sysNode' | 'sysGroup'>;

export interface SysEdgeData extends Record<string, unknown> {
  rendered: RenderedEdge;
  /** Text drawn on the edge (label/protocol, ×N, "(?)"). */
  text: string;
  /** Tooltip listing the original edges of an aggregated edge. */
  tooltip: string | undefined;
}

export type SysFlowEdge = Edge<SysEdgeData, 'sysEdge'>;

export function buildFlowNodes(
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
  boxes: Boxes,
  selectedId: string | undefined,
): SysFlowNode[] {
  const placed = new Set<string>();
  const nodes: SysFlowNode[] = [];
  for (const id of visibleNodeIds(tree, expanded)) {
    const node = tree.byId.get(id);
    const box = boxes[id];
    const parentId = tree.parentOf.get(id);
    // nodes without a box yet (layout pending), or whose parent was skipped, are not rendered
    if (!node || !box || (parentId !== undefined && !placed.has(parentId))) continue;
    placed.add(id);
    const group = isExpandedGroup(id, tree, expanded);
    nodes.push({
      id,
      type: group ? 'sysGroup' : 'sysNode',
      position: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      ...(parentId !== undefined ? { parentId } : {}),
      selected: id === selectedId,
      data: {
        name: node.name,
        type: node.type,
        technology: node.technology,
        hosting: node.hosting,
        assumed: node.confidence === 'assumed',
        descendantCount: tree.descendantsOf(id).length,
        isGroup: tree.isGroup(id),
      },
    });
  }
  return nodes;
}

export function edgeText(edge: RenderedEdge): string {
  const base = edge.aggregated ? t.canvas.aggregatedLabel(edge.edgeIds.length) : (edge.label ?? '');
  if (!edge.assumed) return base;
  return base ? `${base} ${t.canvas.assumedSuffix}` : t.canvas.assumedSuffix;
}

export function edgeTooltip(
  edge: RenderedEdge,
  edgesById: ReadonlyMap<string, SysEdge>,
  tree: TreeIndex,
): string | undefined {
  if (!edge.aggregated) return undefined;
  const name = (id: string): string => tree.byId.get(id)?.name ?? id;
  return edge.edgeIds
    .map((id) => edgesById.get(id))
    .filter((e): e is SysEdge => e !== undefined)
    .map((e) => t.canvas.edgeLine(e.label ?? e.protocol ?? '', name(e.source), name(e.target)))
    .join('\n');
}

export function buildFlowEdges(
  rendered: readonly RenderedEdge[],
  nodeIds: ReadonlySet<string>,
  edgesById: ReadonlyMap<string, SysEdge>,
  tree: TreeIndex,
  selectedId: string | undefined,
): SysFlowEdge[] {
  return rendered
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'sysEdge' as const,
      selected: edge.id === selectedId,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      // drawn above group containers so edges between children stay visible
      zIndex: 1,
      data: { rendered: edge, text: edgeText(edge), tooltip: edgeTooltip(edge, edgesById, tree) },
    }));
}
