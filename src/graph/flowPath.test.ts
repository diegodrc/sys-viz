import { describe, expect, it } from 'vitest';
import type { Flow } from '../schema/system';
import { exampleDoc } from '../test/fixtures';
import { aggregateEdges } from './aggregate';
import { expandPath, flowHighlight, formatSteps, stepLocation } from './flowPath';
import { buildTree } from './tree';
import { visibleAncestor } from './visibility';

const doc = exampleDoc();
const tree = buildTree(doc);
const edgesById = new Map(doc.edges.map((e) => [e.id, e]));
const macro = new Set<string>();

function flow(id: string): Flow {
  const found = doc.flows?.find((f) => f.id === id);
  if (!found) throw new Error(`flow ${id} not found`);
  return found;
}

describe('formatSteps (SPEC §6.5 badge)', () => {
  it.each([
    [[3], '3'],
    [[2, 5], '2,5'],
    [[2, 3], '2,3'],
    [[6, 7, 8, 9], '6–9'],
    [[1, 4, 5, 6, 9], '1,4–6,9'],
  ])('%j -> %s', (steps, expected) => {
    expect(formatSteps(steps)).toBe(expected);
  });

  it('uses U+2013 for ranges and sorts/deduplicates input', () => {
    expect(formatSteps([9, 7, 8, 8])).toBe('7–9');
    expect(formatSteps([])).toBe('');
  });
});

describe('flowHighlight', () => {
  it('A6: badges of fluxo-processamento in the macro view', () => {
    const rendered = aggregateEdges(doc, macro, tree);
    const { badges } = flowHighlight(flow('fluxo-processamento'), rendered, edgesById, tree, macro);
    expect(Object.fromEntries(badges)).toEqual({
      'sistema-pedidos->ca-gateway': '2',
      'ca-gateway->sistema-validacao': '3',
      'sistema-validacao->rabbitmq': '6,10',
      'rabbitmq->sistema-validacao': '8,12',
      'sistema-validacao->sistema-externo': '14',
    });
  });

  it('nodes on the path: ends of highlighted edges and collapsed nodes holding internal steps', () => {
    const rendered = aggregateEdges(doc, macro, tree);
    const { nodesOnPath } = flowHighlight(
      flow('fluxo-processamento'),
      rendered,
      edgesById,
      tree,
      macro,
    );
    expect([...nodesOnPath].sort()).toEqual([
      'ca-gateway',
      'rabbitmq',
      'sistema-externo',
      'sistema-pedidos',
      'sistema-validacao',
    ]);
  });

  it('expanded containers of on-path nodes are on the path', () => {
    const expanded = new Set(['sistema-pedidos']);
    const rendered = aggregateEdges(doc, expanded, tree);
    const { nodesOnPath } = flowHighlight(
      flow('fluxo-recebimento'),
      rendered,
      edgesById,
      tree,
      expanded,
    );
    expect(nodesOnPath).toContain('sistema-pedidos');
    expect(nodesOnPath).toContain('db-pedidos'); // collapsed, holds e07's target
    expect(nodesOnPath).not.toContain('worker-pedidos');
  });
});

describe('expandPath', () => {
  it('A7: from the macro view expands exactly the four groups on the path', () => {
    const next = expandPath(flow('fluxo-processamento'), edgesById, tree, macro);
    expect([...next].sort()).toEqual([
      'db-pedidos',
      'rabbitmq',
      'sistema-pedidos',
      'sistema-validacao',
    ]);
  });

  it('A7: afterwards all 14 flow edges are visible individually', () => {
    const f = flow('fluxo-processamento');
    const expanded = expandPath(f, edgesById, tree, macro);
    const rendered = aggregateEdges(doc, expanded, tree);
    const { stepsByEdge } = flowHighlight(f, rendered, edgesById, tree, expanded);
    expect(stepsByEdge.size).toBe(14);
    for (const step of f.steps) {
      const edge = edgesById.get(step.edgeId);
      if (!edge) throw new Error('missing edge');
      expect(visibleAncestor(edge.source, tree, expanded)).toBe(edge.source);
      expect(visibleAncestor(edge.target, tree, expanded)).toBe(edge.target);
    }
  });

  it('keeps the current expansion and does not mutate it', () => {
    const current = new Set(['portal-web']);
    const next = expandPath(flow('fluxo-processamento'), edgesById, tree, current);
    expect(next.has('portal-web')).toBe(true);
    expect([...current]).toEqual(['portal-web']);
  });
});

describe('stepLocation', () => {
  it('reports the collapsed container for internal steps', () => {
    expect(stepLocation(edgesById.get('e08'), tree, macro)).toEqual({
      kind: 'hidden',
      containerId: 'sistema-pedidos',
    });
    expect(stepLocation(edgesById.get('e13'), tree, macro)).toEqual({
      kind: 'rendered',
      renderedEdgeId: 'sistema-validacao->rabbitmq',
    });
    expect(stepLocation(undefined, tree, macro)).toEqual({ kind: 'missing' });
  });
});
