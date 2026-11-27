import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { EdgeRoute, EdgeRoutes } from '../../graph/edgeRoute';
import { FILTER_DIM_OPACITY } from '../../graph/filter';
import type { Boxes } from '../../graph/layout';
import { traceTrigger } from '../../graph/logic';
import { transitionId } from '../../graph/logicLayout';
import type { TreeIndex } from '../../graph/tree';
import type { Handler, LogicStep, StepCategory, Subprocess, SystemDoc } from '../../schema/system';

// Logic graph + ELK layout -> React Flow nodes and edges (SPEC §18.7). Pure (no React).

export interface FollowOption {
  /** Edge whose handler "Seguir" opens. */
  edgeId: string;
  /** Name of the node that runs that handler. */
  label: string;
}

/** "Seguir" on a trigger step (SPEC §18.8). */
export interface FollowInfo {
  options: FollowOption[];
  /** Node reached without mapped logic, for the disabled button's tooltip. */
  unmappedName: string | undefined;
}

export interface LogicStepData extends Record<string, unknown> {
  step: LogicStep;
  /** Short label of `step.edgeId` (chip). */
  edgeLabel: string | undefined;
  subprocessName: string | undefined;
  follow: FollowInfo | undefined;
  /** Outside the category filter. */
  dimmed: boolean;
  pulsing: boolean;
}

export type LogicFlowNode = Node<LogicStepData, 'logicStep'>;

export interface LogicEdgeData extends Record<string, unknown> {
  label: string | undefined;
  route: EdgeRoute | undefined;
}

export type LogicFlowEdge = Edge<LogicEdgeData, 'logicEdge'>;

export interface LogicNodeOptions {
  selectedStepId: string | undefined;
  categories: ReadonlySet<StepCategory>;
  pulseStepId: string | undefined;
  /** Active flow: "Seguir" prefers its handlers. */
  flowId: string | undefined;
}

export function followInfo(
  doc: SystemDoc,
  tree: TreeIndex,
  edgeId: string,
  flowId: string | undefined,
): FollowInfo {
  const trace = traceTrigger(doc, edgeId, flowId);
  const nameOf = (id: string | undefined): string | undefined =>
    id === undefined ? undefined : (tree.byId.get(id)?.name ?? id);
  const targetOf = (id: string): string | undefined => doc.edges.find((e) => e.id === id)?.target;
  return {
    options: trace.handlerEdgeIds.map((id) => ({
      edgeId: id,
      label: nameOf(targetOf(id)) ?? id,
    })),
    unmappedName: nameOf(trace.unmappedNodeIds[0]),
  };
}

export function buildLogicNodes(
  doc: SystemDoc,
  tree: TreeIndex,
  graph: Handler | Subprocess,
  boxes: Boxes,
  options: LogicNodeOptions,
): LogicFlowNode[] {
  const edges = new Map(doc.edges.map((e) => [e.id, e]));
  return graph.steps.flatMap((step): LogicFlowNode[] => {
    const box = boxes[step.id];
    if (!box) return [];
    const edge = step.edgeId === undefined ? undefined : edges.get(step.edgeId);
    const dimmed = options.categories.size > 0 && !options.categories.has(step.category);
    return [
      {
        id: step.id,
        type: 'logicStep',
        position: { x: box.x, y: box.y },
        width: box.width,
        height: box.height,
        selected: step.id === options.selectedStepId,
        draggable: false,
        ...(dimmed ? { style: { opacity: FILTER_DIM_OPACITY } } : {}),
        data: {
          step,
          edgeLabel: edge ? (edge.label ?? edge.protocol ?? edge.id) : undefined,
          subprocessName:
            step.subprocessId === undefined
              ? undefined
              : (doc.logic?.subprocesses?.find((s) => s.id === step.subprocessId)?.name ??
                step.subprocessId),
          follow:
            step.category === 'trigger' && edge
              ? followInfo(doc, tree, edge.id, options.flowId)
              : undefined,
          dimmed,
          pulsing: step.id === options.pulseStepId,
        },
      },
    ];
  });
}

export function buildLogicEdges(
  graph: Handler | Subprocess,
  routes: EdgeRoutes,
  dimmedSteps: ReadonlySet<string>,
): LogicFlowEdge[] {
  const ids = new Set(graph.steps.map((s) => s.id));
  return graph.transitions.flatMap((transition, i): LogicFlowEdge[] => {
    if (!ids.has(transition.from) || !ids.has(transition.to)) return [];
    const id = transitionId(i);
    const dimmed = dimmedSteps.has(transition.from) && dimmedSteps.has(transition.to);
    return [
      {
        id,
        source: transition.from,
        target: transition.to,
        type: 'logicEdge',
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        selectable: false,
        ...(dimmed ? { style: { opacity: FILTER_DIM_OPACITY } } : {}),
        data: { label: transition.label, route: routes[id] },
      },
    ];
  });
}
