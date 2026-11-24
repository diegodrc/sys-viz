import type { TreeIndex } from './tree';

// Node search (SPEC §6.4): name, id and technology, case- and accent-insensitive. Pure.

export interface SearchResult {
  id: string;
  /** Hierarchical path of names, root first, ending with the node itself. */
  path: string[];
}

export const MAX_SEARCH_RESULTS = 20;

/** Lower-cases and strips diacritics: "Validação" -> "validacao". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function searchNodes(
  tree: TreeIndex,
  query: string,
  limit = MAX_SEARCH_RESULTS,
): SearchResult[] {
  const needle = normalizeText(query.trim());
  if (needle === '') return [];
  const results: SearchResult[] = [];
  for (const id of tree.order) {
    const node = tree.byId.get(id);
    if (!node) continue;
    const haystacks = [node.name, node.id, node.technology ?? ''];
    if (!haystacks.some((h) => normalizeText(h).includes(needle))) continue;
    const path = [...tree.ancestorsOf(id), id].map((a) => tree.byId.get(a)?.name ?? a);
    results.push({ id, path });
    if (results.length >= limit) break;
  }
  return results;
}
