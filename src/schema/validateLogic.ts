import { t } from '../i18n/pt-BR';
import { listGraphs, type GraphEntry, type GraphRef } from './logic';
import { error, formatPath, warning, type Issue } from './result';
import type { SystemDoc } from './system';

// Business-logic validation (SPEC §18.5). Pure; runs after the node/edge/flow checks, so every
// edge and node id it sees is known to be unique.

/** Node id -> parent id (undefined for roots). */
export type ParentMap = ReadonlyMap<string, string | undefined>;

function graphLabel(ref: GraphRef): string {
  return ref.kind === 'handler'
    ? t.validation.logic.handlerLabel(ref.edgeId)
    : t.validation.logic.subprocessLabel(ref.id);
}

function isSelfOrDescendant(ancestor: string, node: string, parentOf: ParentMap): boolean {
  let current: string | undefined = node;
  while (current !== undefined) {
    if (current === ancestor) return true;
    current = parentOf.get(current);
  }
  return false;
}

/** Errors 1–7 of SPEC §18.5. */
export function logicErrors(doc: SystemDoc): Issue[] {
  const m = t.validation.logic;
  const issues: Issue[] = [];
  const edgeIds = new Set(doc.edges.map((e) => e.id));
  const graphs = listGraphs(doc);

  // 1. handler edge exists, one handler per edge
  const handled = new Set<string>();
  (doc.logic?.handlers ?? []).forEach((handler, i) => {
    const path = formatPath(['logic', 'handlers', i, 'edgeId']);
    if (!edgeIds.has(handler.edgeId))
      issues.push(error(path, m.missingHandlerEdge(handler.edgeId)));
    else if (handled.has(handler.edgeId))
      issues.push(error(path, m.duplicateHandler(handler.edgeId)));
    handled.add(handler.edgeId);
  });

  // 2. unique step ids (whole document) and subprocess ids
  const subprocessIds = new Set<string>();
  (doc.logic?.subprocesses ?? []).forEach((sp, i) => {
    if (subprocessIds.has(sp.id)) {
      issues.push(
        error(formatPath(['logic', 'subprocesses', i, 'id']), m.duplicateSubprocess(sp.id)),
      );
    }
    subprocessIds.add(sp.id);
  });
  const stepIds = new Set<string>();
  for (const { graph, path } of graphs) {
    graph.steps.forEach((step, j) => {
      const at = [...path, 'steps', j];
      if (stepIds.has(step.id))
        issues.push(error(formatPath([...at, 'id']), m.duplicateStep(step.id)));
      stepIds.add(step.id);
      // 4. references
      if (step.edgeId !== undefined && !edgeIds.has(step.edgeId)) {
        issues.push(error(formatPath([...at, 'edgeId']), m.missingStepEdge(step.id, step.edgeId)));
      }
      if (step.subprocessId !== undefined && !subprocessIds.has(step.subprocessId)) {
        issues.push(
          error(
            formatPath([...at, 'subprocessId']),
            m.missingSubprocess(step.id, step.subprocessId),
          ),
        );
      }
      // 6. outcome only on end
      if (step.outcome !== undefined && step.category !== 'end') {
        issues.push(error(formatPath([...at, 'outcome']), m.outcomeNotEnd(step.id)));
      }
    });
  }

  for (const { ref, graph, path } of graphs) {
    // 3. transitions inside the graph
    const ids = new Set(graph.steps.map((s) => s.id));
    graph.transitions.forEach((transition, k) => {
      if (!ids.has(transition.from) || !ids.has(transition.to)) {
        issues.push(
          error(
            formatPath([...path, 'transitions', k]),
            m.badTransition(graphLabel(ref), transition.from, transition.to),
          ),
        );
      }
    });
    // 5. exactly one start
    const starts = graph.steps.filter((s) => s.category === 'start').length;
    if (starts !== 1) {
      issues.push(error(formatPath([...path, 'steps']), m.startCount(graphLabel(ref), starts)));
    }
  }

  // 7. subprocess cycles
  const cycle = subprocessCycle(doc);
  if (cycle) issues.push(error('logic.subprocesses', m.subprocessCycle(cycle)));

  return issues;
}

/** A cycle of subprocess ids (first id repeated at the end), or undefined. */
export function subprocessCycle(doc: SystemDoc): string[] | undefined {
  const uses = new Map<string, string[]>();
  for (const sp of doc.logic?.subprocesses ?? []) {
    uses.set(
      sp.id,
      sp.steps.map((s) => s.subprocessId).filter((id): id is string => id !== undefined),
    );
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (id: string): string[] | undefined => {
    if (state.get(id) === 'done') return undefined;
    if (state.get(id) === 'visiting') return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 'visiting');
    stack.push(id);
    for (const next of uses.get(id) ?? []) {
      if (!uses.has(next)) continue;
      const found = visit(next);
      if (found) return found;
    }
    stack.pop();
    state.set(id, 'done');
    return undefined;
  };
  for (const id of uses.keys()) {
    const found = visit(id);
    if (found) return found;
  }
  return undefined;
}

function graphWarnings({ ref, graph, path }: GraphEntry): Issue[] {
  const m = t.validation.logic;
  const issues: Issue[] = [];
  const label = graphLabel(ref);

  // 1. decisions: two or more labelled exits
  graph.steps.forEach((step, j) => {
    if (step.category !== 'decision') return;
    const exits = graph.transitions.filter((tr) => tr.from === step.id);
    if (exits.length < 2) {
      issues.push(warning(formatPath([...path, 'steps', j]), m.decisionExits(step.id)));
    }
    for (const exit of exits) {
      if (!exit.label?.trim()) {
        issues.push(warning(formatPath([...path, 'steps', j]), m.decisionLabel(step.id, exit.to)));
      }
    }
  });

  // 2. at least one end
  if (!graph.steps.some((s) => s.category === 'end')) {
    issues.push(warning(formatPath([...path, 'steps']), m.noEnd(label)));
  }

  // 3. reachable from start
  const start = graph.steps.find((s) => s.category === 'start');
  if (start) {
    const reached = new Set([start.id]);
    const queue = [start.id];
    while (queue.length > 0) {
      const id = queue.shift();
      for (const tr of graph.transitions) {
        if (tr.from === id && !reached.has(tr.to)) {
          reached.add(tr.to);
          queue.push(tr.to);
        }
      }
    }
    graph.steps.forEach((step, j) => {
      if (!reached.has(step.id)) {
        issues.push(warning(formatPath([...path, 'steps', j]), m.unreachable(step.id, label)));
      }
    });
  }
  return issues;
}

/** Warnings 1–6 of SPEC §18.5 (call only on a document without logic errors). */
export function logicWarnings(doc: SystemDoc, parentOf: ParentMap): Issue[] {
  const m = t.validation.logic;
  const graphs = listGraphs(doc);
  const issues = graphs.flatMap(graphWarnings);
  const edges = new Map(doc.edges.map((e) => [e.id, e]));
  const nameOf = new Map<string, string>();
  const collect = (nodes: SystemDoc['nodes']): void => {
    for (const node of nodes) {
      nameOf.set(node.id, node.name);
      collect(node.children ?? []);
    }
  };
  collect(doc.nodes);
  const name = (id: string): string => nameOf.get(id) ?? id;

  // 4. unused subprocesses
  const used = new Set(
    graphs.flatMap(({ graph }) => graph.steps.map((s) => s.subprocessId)).filter(Boolean),
  );
  (doc.logic?.subprocesses ?? []).forEach((sp, i) => {
    if (!used.has(sp.id)) {
      issues.push(warning(formatPath(['logic', 'subprocesses', i]), m.unusedSubprocess(sp.id)));
    }
  });

  // 5. handler steps must use edges leaving the handler's node (or a descendant)
  const referencedByNode = new Map<string, Set<string>>();
  (doc.logic?.handlers ?? []).forEach((handler, i) => {
    const node = edges.get(handler.edgeId)?.target;
    if (node === undefined) return;
    const referenced = referencedByNode.get(node) ?? new Set<string>();
    referencedByNode.set(node, referenced);
    handler.steps.forEach((step, j) => {
      if (step.edgeId === undefined) return;
      referenced.add(step.edgeId);
      const edge = edges.get(step.edgeId);
      if (edge && !isSelfOrDescendant(node, edge.source, parentOf)) {
        issues.push(
          warning(
            formatPath(['logic', 'handlers', i, 'steps', j, 'edgeId']),
            m.stepEdgeElsewhere(step.id, edge.id, name(node)),
          ),
        );
      }
    });
  });

  // 6. outgoing edges of a node with handlers that no step of those handlers uses
  for (const [node, referenced] of referencedByNode) {
    for (const edge of doc.edges) {
      if (edge.source === node && !referenced.has(edge.id)) {
        issues.push(
          warning(formatPath(['logic', 'handlers']), m.edgeNotInLogic(edge.id, name(node))),
        );
      }
    }
  }
  return issues;
}
