import type { Flow, SysEdge } from '../schema/system';
import { renderedEdgeId, type RenderedEdge } from './aggregate';
import type { TreeIndex } from './tree';
import { visibleAncestor } from './visibility';

// Flow highlighting, step badges and "Expandir caminho" (SPEC §6.5).

const RANGE_DASH = '–'; // en dash, SPEC §6.5
const MIN_RANGE = 3;

/** `[1,4,5,6,9]` -> `1,4–6,9`; runs of 3+ consecutive numbers become a range. */
export function formatSteps(steps: readonly number[]): string {
  const sorted = [...new Set(steps)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === (sorted[j] ?? 0) + 1) j++;
    const run = sorted.slice(i, j + 1);
    if (run.length >= MIN_RANGE) parts.push(`${run[0]}${RANGE_DASH}${run[run.length - 1]}`);
    else parts.push(...run.map(String));
    i = j + 1;
  }
  return parts.join(',');
}

export type StepLocation =
  | { kind: 'rendered'; renderedEdgeId: string }
  /** The step's edge is internal to a collapsed node (shown as a hint, SPEC §6.5). */
  | { kind: 'hidden'; containerId: string }
  /** The step references an edge that does not exist (cannot happen after validation). */
  | { kind: 'missing' };

export function stepLocation(
  edge: SysEdge | undefined,
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
): StepLocation {
  if (!edge) return { kind: 'missing' };
  const source = visibleAncestor(edge.source, tree, expanded);
  const target = visibleAncestor(edge.target, tree, expanded);
  if (source === target) return { kind: 'hidden', containerId: source };
  return { kind: 'rendered', renderedEdgeId: renderedEdgeId(source, target) };
}

export interface FlowHighlight {
  /** Rendered edge id -> step numbers (1-based) it contains, ascending. */
  stepsByEdge: Map<string, number[]>;
  /** Rendered edge id -> badge text (see formatSteps). */
  badges: Map<string, string>;
  /** Nodes that stay at full opacity. */
  nodesOnPath: Set<string>;
}

export function flowHighlight(
  flow: Flow,
  rendered: readonly RenderedEdge[],
  edgesById: ReadonlyMap<string, SysEdge>,
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
): FlowHighlight {
  const renderedById = new Map(rendered.map((e) => [e.id, e]));
  const stepsByEdge = new Map<string, number[]>();
  const onPath = new Set<string>();

  flow.steps.forEach((step, index) => {
    const location = stepLocation(edgesById.get(step.edgeId), tree, expanded);
    if (location.kind === 'hidden') {
      onPath.add(location.containerId);
    } else if (location.kind === 'rendered') {
      const edge = renderedById.get(location.renderedEdgeId);
      if (!edge) return;
      const steps = stepsByEdge.get(edge.id) ?? [];
      steps.push(index + 1);
      stepsByEdge.set(edge.id, steps);
      onPath.add(edge.source);
      onPath.add(edge.target);
    }
  });

  // expanded containers around nodes on the path are on the path too
  for (const id of [...onPath]) {
    for (const ancestor of tree.ancestorsOf(id)) onPath.add(ancestor);
  }

  const badges = new Map<string, string>();
  for (const [id, steps] of stepsByEdge) badges.set(id, formatSteps(steps));
  return { stepsByEdge, badges, nodesOnPath: onPath };
}

/** Minimal expansion so that both ends of every flow edge are visible (keeps current state). */
export function expandPath(
  flow: Flow,
  edgesById: ReadonlyMap<string, SysEdge>,
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
): Set<string> {
  const next = new Set(expanded);
  for (const step of flow.steps) {
    const edge = edgesById.get(step.edgeId);
    if (!edge) continue;
    for (const id of [edge.source, edge.target]) {
      for (const ancestor of tree.ancestorsOf(id)) next.add(ancestor);
    }
  }
  return next;
}
