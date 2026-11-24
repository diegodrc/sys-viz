import type { TreeIndex } from './tree';

// Which nodes are visible for a given set of expanded group ids (SPEC §3, §5.4, §6.4).

export function visibleAncestor(
  id: string,
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
): string {
  // ancestors are ordered from root to parent; the first collapsed one hides everything below it
  for (const ancestor of tree.ancestorsOf(id)) {
    if (!expanded.has(ancestor)) return ancestor;
  }
  return id;
}

export function isVisible(id: string, tree: TreeIndex, expanded: ReadonlySet<string>): boolean {
  return tree.ancestorsOf(id).every((ancestor) => expanded.has(ancestor));
}

/** A visible group rendered as a container (vs. a collapsed group drawn as a regular card). */
export function isExpandedGroup(
  id: string,
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
): boolean {
  return tree.isGroup(id) && expanded.has(id) && isVisible(id, tree, expanded);
}

/** Visible node ids in pre-order (parents before children), containers included. */
export function visibleNodeIds(tree: TreeIndex, expanded: ReadonlySet<string>): string[] {
  return tree.order.filter((id) => isVisible(id, tree, expanded));
}

export function expandAll(tree: TreeIndex): Set<string> {
  return new Set(tree.order.filter((id) => tree.isGroup(id)));
}

/** "Expandir até nível N": level 1 shows only roots, so groups above level N are expanded. */
export function expandToLevel(tree: TreeIndex, level: number): Set<string> {
  return new Set(
    tree.order.filter((id) => tree.isGroup(id) && (tree.levelOf.get(id) ?? 0) < level),
  );
}

/** Makes `id` visible by expanding all of its ancestors. */
export function expandAncestors(
  id: string,
  tree: TreeIndex,
  expanded: ReadonlySet<string>,
): Set<string> {
  return new Set([...expanded, ...tree.ancestorsOf(id)]);
}

/** Drops ids that are not groups of this document (e.g. after a replace). */
export function pruneExpanded(tree: TreeIndex, expanded: Iterable<string>): Set<string> {
  return new Set([...expanded].filter((id) => tree.isGroup(id)));
}
