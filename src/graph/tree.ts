import type { SysNode, SystemDoc } from '../schema/system';

// Hierarchy indexes over a SystemDoc. Levels follow SPEC §6.4: root nodes are level 1.

export interface TreeIndex {
  readonly byId: ReadonlyMap<string, SysNode>;
  /** Parent id of each node; `undefined` for roots. */
  readonly parentOf: ReadonlyMap<string, string | undefined>;
  /** Level of each node (roots = 1). */
  readonly levelOf: ReadonlyMap<string, number>;
  readonly rootIds: readonly string[];
  /** All node ids in pre-order (document order, parents before children). */
  readonly order: readonly string[];
  /** Deepest level in the document. */
  readonly maxLevel: number;
  childIds(id: string): readonly string[];
  /** Ancestors ordered from root to parent (empty for roots). */
  ancestorsOf(id: string): readonly string[];
  /** All descendants in pre-order. */
  descendantsOf(id: string): readonly string[];
  isGroup(id: string): boolean;
}

export function buildTree(doc: SystemDoc): TreeIndex {
  const byId = new Map<string, SysNode>();
  const parentOf = new Map<string, string | undefined>();
  const levelOf = new Map<string, number>();
  const children = new Map<string, string[]>();
  const order: string[] = [];
  let maxLevel = 0;

  const stack: { node: SysNode; parent: string | undefined; level: number }[] = [];
  for (let i = doc.nodes.length - 1; i >= 0; i--) {
    const node = doc.nodes[i];
    if (node) stack.push({ node, parent: undefined, level: 1 });
  }
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) break;
    const { node, parent, level } = entry;
    byId.set(node.id, node);
    parentOf.set(node.id, parent);
    levelOf.set(node.id, level);
    order.push(node.id);
    maxLevel = Math.max(maxLevel, level);
    const kids = node.children ?? [];
    children.set(
      node.id,
      kids.map((k) => k.id),
    );
    for (let i = kids.length - 1; i >= 0; i--) {
      const kid = kids[i];
      if (kid) stack.push({ node: kid, parent: node.id, level: level + 1 });
    }
  }

  const ancestorsCache = new Map<string, readonly string[]>();
  const ancestorsOf = (id: string): readonly string[] => {
    const cached = ancestorsCache.get(id);
    if (cached) return cached;
    const chain: string[] = [];
    let current = parentOf.get(id);
    while (current !== undefined) {
      chain.push(current);
      current = parentOf.get(current);
    }
    chain.reverse();
    ancestorsCache.set(id, chain);
    return chain;
  };

  const descendantsOf = (id: string): readonly string[] => {
    const out: string[] = [];
    const pending = [...(children.get(id) ?? [])].reverse();
    while (pending.length > 0) {
      const next = pending.pop();
      if (next === undefined) break;
      out.push(next);
      const kids = children.get(next) ?? [];
      for (let i = kids.length - 1; i >= 0; i--) {
        const kid = kids[i];
        if (kid !== undefined) pending.push(kid);
      }
    }
    return out;
  };

  return {
    byId,
    parentOf,
    levelOf,
    rootIds: doc.nodes.map((n) => n.id),
    order,
    maxLevel,
    childIds: (id) => children.get(id) ?? [],
    ancestorsOf,
    descendantsOf,
    isGroup: (id) => (children.get(id)?.length ?? 0) > 0,
  };
}
