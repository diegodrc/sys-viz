import type { ElkNode, LayoutOptions } from 'elkjs/lib/elk-api';
import type { Handler, StepCategory, Subprocess } from '../schema/system';
import { readElkRoutes, type EdgeRoutes } from './edgeRoute';
import { readElkLayout, type Boxes } from './layout';

// ELK input/output for a logic flowchart (SPEC §18.7): layered, top to bottom, read-only (no
// saved positions). Pure.

export const STEP_WIDTH = 240;
export const STEP_HEIGHT = 64;
/** Decisions are drawn as a hexagon/diamond and need more height for the same text. */
export const DECISION_HEIGHT = 84;

const LOGIC_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.json.edgeCoords': 'ROOT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '56',
  'elk.spacing.nodeNode': '48',
  'elk.spacing.edgeEdge': '16',
  'elk.spacing.edgeNode': '24',
  'elk.spacing.edgeLabel': '4',
  'elk.edgeLabels.placement': 'CENTER',
};

/** Rendered id of a transition: its index in the graph's `transitions`. */
export function transitionId(index: number): string {
  return `tr-${index}`;
}

export function stepHeight(category: StepCategory): number {
  return category === 'decision' ? DECISION_HEIGHT : STEP_HEIGHT;
}

/** Rough label size, so ELK leaves room for decision branch labels. */
function labelSize(text: string): { width: number; height: number } {
  return { width: Math.min(160, text.length * 7 + 12), height: 18 };
}

export function buildLogicElkGraph(graph: Handler | Subprocess): ElkNode {
  const ids = new Set(graph.steps.map((s) => s.id));
  return {
    id: '__logic__',
    layoutOptions: LOGIC_LAYOUT_OPTIONS,
    children: graph.steps.map((step) => ({
      id: step.id,
      width: STEP_WIDTH,
      height: stepHeight(step.category),
    })),
    // a transition to an unknown step cannot be laid out (validation rejects it anyway)
    edges: graph.transitions.flatMap((transition, i) =>
      ids.has(transition.from) && ids.has(transition.to)
        ? [
            {
              id: transitionId(i),
              sources: [transition.from],
              targets: [transition.to],
              ...(transition.label
                ? { labels: [{ text: transition.label, ...labelSize(transition.label) }] }
                : {}),
            },
          ]
        : [],
    ),
  };
}

export interface LogicLayoutResult {
  boxes: Boxes;
  routes: EdgeRoutes;
}

export function readLogicLayout(result: ElkNode): LogicLayoutResult {
  return { boxes: readElkLayout(result), routes: readElkRoutes(result) };
}
