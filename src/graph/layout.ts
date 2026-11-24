import type { ElkExtendedEdge, ElkNode, LayoutOptions } from 'elkjs/lib/elk-api';
import type { RenderedEdge } from './aggregate';
import { fitGroupToChildren, GROUP_PADDING, type Box, type Positions } from './positions';
import type { TreeIndex } from './tree';
import { isExpandedGroup, visibleNodeIds } from './visibility';

// ELK input/output conversion (SPEC §5.5). Pure: running ELK itself happens elsewhere (worker).

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 64;
export const ROOT_ID = '__root__';

export const ROOT_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.nodeNode': '40',
};

const GROUP_LAYOUT_OPTIONS: LayoutOptions = {
  'elk.padding': `[top=${GROUP_PADDING.top},left=${GROUP_PADDING.left},bottom=${GROUP_PADDING.bottom},right=${GROUP_PADDING.right}]`,
};

export type Boxes = Record<string, Box>;

/** Deepest expanded group containing both ends (the edge's ELK container), or the root. */
export function edgeContainer(source: string, target: string, tree: TreeIndex): string {
  const a = tree.ancestorsOf(source);
  const b = tree.ancestorsOf(target);
  let lca: string = ROOT_ID;
  for (let i = 0; i < Math.min(a.length, b.length) && a[i] === b[i]; i++) lca = a[i] ?? ROOT_ID;
  return lca;
}

/** ELK graph of the visible nodes and rendered edges (SPEC §5.5). */
export function buildElkGraph(
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
  rendered: readonly RenderedEdge[],
): ElkNode {
  const root: ElkNode = {
    id: ROOT_ID,
    layoutOptions: ROOT_LAYOUT_OPTIONS,
    children: [],
    edges: [],
  };
  const containers = new Map<string, ElkNode>([[ROOT_ID, root]]);

  // pre-order guarantees a parent container exists before its children are attached
  for (const id of visibleNodeIds(tree, expanded)) {
    const parent = containers.get(tree.parentOf.get(id) ?? ROOT_ID) ?? root;
    const node: ElkNode = isExpandedGroup(id, tree, expanded)
      ? { id, layoutOptions: GROUP_LAYOUT_OPTIONS, children: [], edges: [] }
      : { id, width: NODE_WIDTH, height: NODE_HEIGHT };
    (parent.children ??= []).push(node);
    if (node.children) containers.set(id, node);
  }

  for (const edge of rendered) {
    const container = containers.get(edgeContainer(edge.source, edge.target, tree)) ?? root;
    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    };
    (container.edges ??= []).push(elkEdge);
  }
  return root;
}

/** Positions (relative to the parent) and sizes from an ELK result; edge routes are ignored. */
export function readElkLayout(result: ElkNode): Boxes {
  const boxes: Boxes = {};
  const stack: ElkNode[] = [...(result.children ?? [])];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    boxes[node.id] = {
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? NODE_WIDTH,
      height: node.height ?? NODE_HEIGHT,
    };
    stack.push(...(node.children ?? []));
  }
  return boxes;
}

/** Visible children of an expanded group, with their boxes. */
function childBoxes(id: string, tree: TreeIndex, boxes: Boxes): Record<string, Box> {
  const out: Record<string, Box> = {};
  for (const child of tree.childIds(id)) {
    const box = boxes[child];
    if (box) out[child] = box;
  }
  return out;
}

/** Re-fits one expanded group around its children, writing results into `boxes`. */
function refitGroup(id: string, tree: TreeIndex, boxes: Boxes): { shifted: boolean } {
  const box = boxes[id];
  if (!box) return { shifted: false };
  const fit = fitGroupToChildren(box, childBoxes(id, tree, boxes));
  for (const [child, position] of Object.entries(fit.children)) {
    const childBox = boxes[child];
    if (childBox) boxes[child] = { ...childBox, ...position };
  }
  boxes[id] = {
    ...fit.group,
    width: Math.max(fit.group.width, NODE_WIDTH),
    height: Math.max(fit.group.height, NODE_HEIGHT),
  };
  return fit;
}

/**
 * After ELK: saved positions override x/y, then every expanded group is re-fitted around its
 * children, innermost first (SPEC §5.5).
 */
export function applySavedPositions(
  boxes: Boxes,
  saved: Positions,
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
): Boxes {
  const out: Boxes = { ...boxes };
  const visible = visibleNodeIds(tree, expanded);
  for (const id of visible) {
    const position = saved[id];
    const box = out[id];
    if (position && box) out[id] = { ...box, x: position.x, y: position.y };
  }
  for (const id of [...visible].reverse()) {
    if (isExpandedGroup(id, tree, expanded)) refitGroup(id, tree, out);
  }
  return out;
}

/**
 * Drop of a dragged node (SPEC §5.5): stores its new relative position, re-fits its ancestors in
 * cascade and returns the boxes plus every position that must be persisted (the node; and, when a
 * group origin shifts, all of that group's children and the group itself if it had a saved
 * position).
 */
export function settleDrag(
  boxes: Boxes,
  tree: TreeIndex,
  saved: Positions,
  draggedId: string,
  position: { x: number; y: number },
): { boxes: Boxes; updates: Positions } {
  const out: Boxes = { ...boxes };
  const updates: Positions = { [draggedId]: position };
  const dragged = out[draggedId];
  if (dragged) out[draggedId] = { ...dragged, ...position };

  let groupId = tree.parentOf.get(draggedId);
  while (groupId !== undefined) {
    const { shifted } = refitGroup(groupId, tree, out);
    if (shifted) {
      for (const child of tree.childIds(groupId)) {
        const box = out[child];
        if (box) updates[child] = { x: box.x, y: box.y };
      }
      const group = out[groupId];
      if (group && (saved[groupId] || updates[groupId])) {
        updates[groupId] = { x: group.x, y: group.y };
      }
    }
    groupId = tree.parentOf.get(groupId);
  }
  return { boxes: out, updates };
}
