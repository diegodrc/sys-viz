import type { HostingPlatform, NodeType, SysNode } from '../schema/system';
import type { RenderedEdge } from './aggregate';
import type { TreeIndex } from './tree';

// Type / hosting filters (SPEC §6.4). Nodes outside the filter are dimmed, never hidden. Pure.

/** "sem hosting" option of the platform filter. */
export const NO_HOSTING = 'none';
export type PlatformFilterValue = HostingPlatform | typeof NO_HOSTING;

export interface NodeFilters {
  types: ReadonlySet<NodeType>;
  platforms: ReadonlySet<PlatformFilterValue>;
}

export const EMPTY_FILTERS: NodeFilters = { types: new Set(), platforms: new Set() };

/** Opacity of nodes/edges outside the filter (SPEC §6.4). */
export const FILTER_DIM_OPACITY = 0.25;

export function isFilterActive(filters: NodeFilters): boolean {
  return filters.types.size > 0 || filters.platforms.size > 0;
}

/** Each category is OR within itself; both categories must match (AND) when both are set. */
export function matchesFilters(node: SysNode, filters: NodeFilters): boolean {
  if (filters.types.size > 0 && !filters.types.has(node.type)) return false;
  if (filters.platforms.size > 0) {
    const platform: PlatformFilterValue = node.hosting?.platform ?? NO_HOSTING;
    if (!filters.platforms.has(platform)) return false;
  }
  return true;
}

/**
 * Visible nodes dimmed by the filter. A group (collapsed or expanded) stays lit if it or any
 * descendant matches.
 */
export function filterDimmedNodes(
  tree: TreeIndex,
  visibleIds: readonly string[],
  filters: NodeFilters,
): Set<string> {
  const dimmed = new Set<string>();
  if (!isFilterActive(filters)) return dimmed;
  for (const id of visibleIds) {
    const lit = [id, ...tree.descendantsOf(id)].some((candidate) => {
      const node = tree.byId.get(candidate);
      return node !== undefined && matchesFilters(node, filters);
    });
    if (!lit) dimmed.add(id);
  }
  return dimmed;
}

/** Rendered edges are dimmed when both of their ends are dimmed. */
export function filterDimmedEdges(
  rendered: readonly RenderedEdge[],
  dimmedNodes: ReadonlySet<string>,
): Set<string> {
  return new Set(
    rendered
      .filter((edge) => dimmedNodes.has(edge.source) && dimmedNodes.has(edge.target))
      .map((edge) => edge.id),
  );
}

/** Node types and hosting options present in the document (for the filter menu). */
export function filterOptions(tree: TreeIndex): {
  types: NodeType[];
  platforms: PlatformFilterValue[];
} {
  const types = new Set<NodeType>();
  const platforms = new Set<PlatformFilterValue>();
  for (const node of tree.byId.values()) {
    types.add(node.type);
    platforms.add(node.hosting?.platform ?? NO_HOSTING);
  }
  return { types: [...types], platforms: [...platforms] };
}
