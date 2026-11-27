import { handlerName, listGraphs, type GraphRef } from '../schema/logic';
import type {
  Handler,
  LogicField,
  NodeType,
  Subprocess,
  SysEdge,
  SystemDoc,
} from '../schema/system';
import { normalizeText } from './search';
import type { TreeIndex } from './tree';

// Business-logic indexes and navigation (SPEC §18.6, §18.8, §18.9). Pure.

export interface StepRef {
  graph: GraphRef;
  stepId: string;
}

export interface LogicIndex {
  handlersByEdge: ReadonlyMap<string, Handler>;
  subprocessById: ReadonlyMap<string, Subprocess>;
  /** Edge id -> steps that reference it through `edgeId` ("Usada em"). */
  usagesOfEdge: ReadonlyMap<string, readonly StepRef[]>;
  /** Subprocess id -> steps that open it ("Usado em"). */
  usagesOfSubprocess: ReadonlyMap<string, readonly StepRef[]>;
  /** Node id -> ids of the incoming edges that have a handler. */
  handlersOfNode: ReadonlyMap<string, readonly string[]>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildLogicIndex(doc: SystemDoc): LogicIndex {
  const edges = new Map(doc.edges.map((e) => [e.id, e]));
  const handlersByEdge = new Map<string, Handler>();
  const handlersOfNode = new Map<string, string[]>();
  for (const handler of doc.logic?.handlers ?? []) {
    handlersByEdge.set(handler.edgeId, handler);
    const target = edges.get(handler.edgeId)?.target;
    if (target !== undefined) push(handlersOfNode, target, handler.edgeId);
  }
  const subprocessById = new Map((doc.logic?.subprocesses ?? []).map((s) => [s.id, s]));
  const usagesOfEdge = new Map<string, StepRef[]>();
  const usagesOfSubprocess = new Map<string, StepRef[]>();
  for (const { ref, graph } of listGraphs(doc)) {
    for (const step of graph.steps) {
      if (step.edgeId !== undefined)
        push(usagesOfEdge, step.edgeId, { graph: ref, stepId: step.id });
      if (step.subprocessId !== undefined) {
        push(usagesOfSubprocess, step.subprocessId, { graph: ref, stepId: step.id });
      }
    }
  }
  return { handlersByEdge, subprocessById, usagesOfEdge, usagesOfSubprocess, handlersOfNode };
}

/**
 * Handler badge of a visible node (SPEC §18.6): its own handlers, plus its descendants' when it is
 * a collapsed group.
 */
export function handlerBadgeCount(
  nodeId: string,
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
  index: LogicIndex,
): number {
  const own = index.handlersOfNode.get(nodeId)?.length ?? 0;
  if (!tree.isGroup(nodeId) || expanded.has(nodeId)) return own;
  return tree
    .descendantsOf(nodeId)
    .reduce((sum, id) => sum + (index.handlersOfNode.get(id)?.length ?? 0), own);
}

/** True when a rendered edge (one or more originals) carries at least one handler. */
export function anyHasHandler(edgeIds: readonly string[], index: LogicIndex): boolean {
  return edgeIds.some((id) => index.handlersByEdge.has(id));
}

// ---------------------------------------------------------------------------------------------
// "Seguir" (SPEC §18.8)

/** Node types a request passes through without running business logic. */
export const PASS_THROUGH_TYPES: ReadonlySet<NodeType> = new Set([
  'exchange',
  'queue',
  'topic',
  'broker',
  'gateway',
  'ingress',
  'cdn',
]);

export const MAX_FOLLOW_DEPTH = 10;

export interface TriggerTrace {
  /** Edges with a handler reached from the trigger edge (what "Seguir" opens). */
  handlerEdgeIds: string[];
  /** Nodes reached that run code but whose incoming edge has no handler yet. */
  unmappedNodeIds: string[];
}

export function traceTrigger(doc: SystemDoc, edgeId: string, flowId?: string): TriggerTrace {
  const index = buildLogicIndex(doc);
  if (index.handlersByEdge.has(edgeId)) return { handlerEdgeIds: [edgeId], unmappedNodeIds: [] };
  const edges = new Map<string, SysEdge>(doc.edges.map((e) => [e.id, e]));
  const types = new Map<string, NodeType>();
  const collect = (nodes: SystemDoc['nodes']): void => {
    for (const node of nodes) {
      types.set(node.id, node.type);
      collect(node.children ?? []);
    }
  };
  collect(doc.nodes);
  const isPass = (id: string): boolean => {
    const type = types.get(id);
    return type !== undefined && PASS_THROUGH_TYPES.has(type);
  };

  const found: string[] = [];
  const unmapped: string[] = [];
  const seen = new Set([edgeId]);
  const queue: { edgeId: string; depth: number }[] = [{ edgeId, depth: 0 }];
  while (queue.length > 0) {
    const entry = queue.shift();
    const target = entry && edges.get(entry.edgeId)?.target;
    if (!entry || target === undefined) continue;
    if (!isPass(target)) {
      if (!unmapped.includes(target)) unmapped.push(target);
      continue;
    }
    if (entry.depth >= MAX_FOLLOW_DEPTH) continue;
    for (const next of doc.edges) {
      if (next.source !== target || seen.has(next.id)) continue;
      seen.add(next.id);
      if (index.handlersByEdge.has(next.id)) found.push(next.id);
      else queue.push({ edgeId: next.id, depth: entry.depth + 1 });
    }
  }

  const flow = flowId === undefined ? undefined : doc.flows?.find((f) => f.id === flowId);
  if (flow) {
    const inFlow = new Set(flow.steps.map((s) => s.edgeId));
    const preferred = found.filter((id) => inFlow.has(id));
    if (preferred.length > 0) return { handlerEdgeIds: preferred, unmappedNodeIds: unmapped };
  }
  return { handlerEdgeIds: found, unmappedNodeIds: unmapped };
}

/** SPEC §18.8: ids of the edges with a handler that "Seguir" can open from `edgeId`. */
export function followTrigger(doc: SystemDoc, edgeId: string, flowId?: string): string[] {
  return traceTrigger(doc, edgeId, flowId).handlerEdgeIds;
}

// ---------------------------------------------------------------------------------------------
// Field search (SPEC §18.9)

/** Where a logic graph lives, for labels such as `API Validação › POST /validacoes`. */
export type GraphPlace =
  { kind: 'handler'; nodeName: string; handlerName: string } | { kind: 'subprocess'; name: string };

export function graphPlace(doc: SystemDoc, tree: TreeIndex, ref: GraphRef): GraphPlace {
  if (ref.kind === 'subprocess') {
    const sp = doc.logic?.subprocesses?.find((s) => s.id === ref.id);
    return { kind: 'subprocess', name: sp?.name ?? ref.id };
  }
  const handler = doc.logic?.handlers?.find((h) => h.edgeId === ref.edgeId);
  const target = doc.edges.find((e) => e.id === ref.edgeId)?.target;
  return {
    kind: 'handler',
    nodeName: (target !== undefined ? tree.byId.get(target)?.name : undefined) ?? '',
    handlerName: handler ? handlerName(doc, handler) : ref.edgeId,
  };
}

export interface FieldResult {
  graph: GraphRef;
  stepId: string;
  stepTitle: string;
  field: LogicField;
  place: GraphPlace;
}

export const MAX_FIELD_RESULTS = 20;

export function searchFields(
  doc: SystemDoc,
  tree: TreeIndex,
  query: string,
  limit = MAX_FIELD_RESULTS,
): FieldResult[] {
  const needle = normalizeText(query.trim());
  if (needle === '') return [];
  const results: FieldResult[] = [];
  for (const { ref, graph } of listGraphs(doc)) {
    for (const step of graph.steps) {
      for (const field of step.fields ?? []) {
        if (!normalizeText(field.name).includes(needle)) continue;
        results.push({
          graph: ref,
          stepId: step.id,
          stepTitle: step.title,
          field,
          place: graphPlace(doc, tree, ref),
        });
        if (results.length >= limit) return results;
      }
    }
  }
  return results;
}
