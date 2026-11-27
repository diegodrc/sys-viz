import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { RenderedEdge } from '../../graph/aggregate';
import type { EdgeRoute, EdgeRoutes } from '../../graph/edgeRoute';
import { flowHighlight, stepLocation, type FlowHighlight } from '../../graph/flowPath';
import { FILTER_DIM_OPACITY } from '../../graph/filter';
import { anyHasHandler, handlerBadgeCount, type LogicIndex } from '../../graph/logic';
import type { Boxes } from '../../graph/layout';
import type { TreeIndex } from '../../graph/tree';
import { isExpandedGroup, visibleNodeIds } from '../../graph/visibility';
import { t } from '../../i18n/pt-BR';
import type { Flow, Hosting, NodeType, SysEdge } from '../../schema/system';

// Converts document + expansion + layout (+ active flow) into React Flow nodes and edges.
// Pure (no React).

/** Opacity of nodes/edges outside the active flow's path (SPEC §6.5). */
export const FLOW_DIM_OPACITY = 0.3;

export interface SysNodeData extends Record<string, unknown> {
  name: string;
  type: NodeType;
  technology: string | undefined;
  hosting: Hosting | undefined;
  assumed: boolean;
  /** Total descendants (badge "+N" on collapsed groups). */
  descendantCount: number;
  isGroup: boolean;
  /** End of the current flow step (highlighted). */
  emphasized: boolean;
  /** Search result: pulses for 2 s (SPEC §6.4). */
  pulsing: boolean;
  /** Handlers mapped on this node (collapsed groups add their descendants', SPEC §18.6). */
  handlerCount: number;
}

export type SysFlowNode = Node<SysNodeData, 'sysNode' | 'sysGroup'>;

/** How an edge relates to the active flow. */
export type EdgeFlowState = 'none' | 'path' | 'current' | 'dimmed';

export interface SysEdgeData extends Record<string, unknown> {
  rendered: RenderedEdge;
  /** Text drawn on the edge (label/protocol, ×N, "(?)"). */
  text: string;
  /** Tooltip listing the original edges of an aggregated edge. */
  tooltip: string | undefined;
  flowState: EdgeFlowState;
  /** Step numbers of the active flow on this edge, e.g. `6,10` (SPEC §6.5). */
  badge: string | undefined;
  /** Opacity from flow/filter dimming (1 = not dimmed); the smaller one wins (SPEC §6.4). */
  dimOpacity: number;
  /** ELK route, drawn while both ends stay where ELK put them. */
  route: EdgeRoute | undefined;
  /** At least one original edge has a handler (logic icon, SPEC §18.6). */
  hasLogic: boolean;
  /** "Ver no mapa" from a logic step: pulses for 2 s (SPEC §18.7). */
  pulsing: boolean;
}

export type SysFlowEdge = Edge<SysEdgeData, 'sysEdge'>;

/** Active-flow decoration for the canvas. */
export interface FlowOverlay {
  highlight: FlowHighlight;
  /** Rendered edge holding the current step, if the step is visible as an edge. */
  currentEdgeId: string | undefined;
  /** Nodes emphasized for the current step: its edge ends, or the collapsed node holding it. */
  currentNodeIds: ReadonlySet<string>;
}

export function buildFlowOverlay(
  flow: Flow,
  step: number | undefined,
  rendered: readonly RenderedEdge[],
  edgesById: ReadonlyMap<string, SysEdge>,
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
): FlowOverlay {
  const highlight = flowHighlight(flow, rendered, edgesById, tree, expanded);
  const current = step === undefined ? undefined : flow.steps[step];
  const location = stepLocation(current && edgesById.get(current.edgeId), tree, expanded);
  if (location.kind === 'rendered') {
    const edge = rendered.find((e) => e.id === location.renderedEdgeId);
    return {
      highlight,
      currentEdgeId: location.renderedEdgeId,
      currentNodeIds: new Set(edge ? [edge.source, edge.target] : []),
    };
  }
  if (location.kind === 'hidden') {
    return { highlight, currentEdgeId: undefined, currentNodeIds: new Set([location.containerId]) };
  }
  return { highlight, currentEdgeId: undefined, currentNodeIds: new Set() };
}

export function buildFlowNodes(
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
  boxes: Boxes,
  selectedId: string | undefined,
  overlay?: FlowOverlay,
  extras: { filterDimmed?: ReadonlySet<string>; pulseId?: string; logic?: LogicIndex } = {},
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
    const opacity = Math.min(
      overlay && !overlay.highlight.nodesOnPath.has(id) ? FLOW_DIM_OPACITY : 1,
      extras.filterDimmed?.has(id) ? FILTER_DIM_OPACITY : 1,
    );
    nodes.push({
      id,
      type: group ? 'sysGroup' : 'sysNode',
      position: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      ...(parentId !== undefined ? { parentId } : {}),
      ...(opacity < 1 ? { style: { opacity } } : {}),
      selected: id === selectedId,
      data: {
        name: node.name,
        type: node.type,
        technology: node.technology,
        hosting: node.hosting,
        assumed: node.confidence === 'assumed',
        descendantCount: tree.descendantsOf(id).length,
        isGroup: tree.isGroup(id),
        emphasized: overlay?.currentNodeIds.has(id) ?? false,
        pulsing: id === extras.pulseId,
        handlerCount: extras.logic ? handlerBadgeCount(id, tree, expanded, extras.logic) : 0,
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

function flowStateOf(edgeId: string, overlay: FlowOverlay | undefined): EdgeFlowState {
  if (!overlay) return 'none';
  if (edgeId === overlay.currentEdgeId) return 'current';
  return overlay.highlight.stepsByEdge.has(edgeId) ? 'path' : 'dimmed';
}

export function buildFlowEdges(
  rendered: readonly RenderedEdge[],
  nodeIds: ReadonlySet<string>,
  edgesById: ReadonlyMap<string, SysEdge>,
  tree: TreeIndex,
  selectedId: string | undefined,
  overlay?: FlowOverlay,
  filterDimmed?: ReadonlySet<string>,
  routes?: EdgeRoutes,
  extras: { logic?: LogicIndex; pulseEdgeId?: string } = {},
): SysFlowEdge[] {
  return rendered
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => {
      const flowState = flowStateOf(edge.id, overlay);
      const onPath = flowState === 'path' || flowState === 'current';
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'sysEdge' as const,
        selected: edge.id === selectedId,
        animated: onPath,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        // drawn above group containers (and highlighted ones above the rest)
        zIndex: onPath ? 2 : 1,
        data: {
          rendered: edge,
          text: edgeText(edge),
          tooltip: edgeTooltip(edge, edgesById, tree),
          flowState,
          badge: overlay?.highlight.badges.get(edge.id),
          dimOpacity: Math.min(
            flowState === 'dimmed' ? FLOW_DIM_OPACITY : 1,
            filterDimmed?.has(edge.id) ? FILTER_DIM_OPACITY : 1,
          ),
          route: routes?.[edge.id],
          hasLogic: extras.logic ? anyHasHandler(edge.edgeIds, extras.logic) : false,
          pulsing: edge.id === extras.pulseEdgeId,
        },
      };
    });
}
