import { describe, expect, it } from 'vitest';
import type { SystemDoc } from '../schema/system';
import { exampleDoc } from '../test/fixtures';
import {
  buildLogicIndex,
  followTrigger,
  graphPlace,
  handlerBadgeCount,
  searchFields,
  traceTrigger,
} from './logic';
import { buildTree } from './tree';
import { expandAll } from './visibility';

describe('buildLogicIndex (SPEC §18.6)', () => {
  const doc = exampleDoc();
  const index = buildLogicIndex(doc);

  it('indexes handlers by incoming edge and by target node', () => {
    expect([...index.handlersByEdge.keys()]).toEqual(['e11', 'e17']);
    expect(index.handlersOfNode.get('api-validacao')).toEqual(['e11']);
    expect(index.handlersOfNode.get('consumer-a')).toEqual(['e17']);
  });

  it('lists where edges and subprocesses are used', () => {
    expect(index.usagesOfEdge.get('e12')).toEqual([
      { graph: { kind: 'handler', edgeId: 'e11' }, stepId: 'val-busca-pedido' },
    ]);
    expect(index.usagesOfSubprocess.get('sp-calcula-aprovacao')).toEqual([
      { graph: { kind: 'handler', edgeId: 'e11' }, stepId: 'val-aprovacao' },
    ]);
    expect(index.usagesOfEdge.has('e01')).toBe(false);
  });
});

describe('handlerBadgeCount (L3)', () => {
  const doc = exampleDoc();
  const tree = buildTree(doc);
  const index = buildLogicIndex(doc);

  it('fully expanded: own handlers only', () => {
    const expanded = expandAll(tree);
    expect(handlerBadgeCount('api-validacao', tree, expanded, index)).toBe(1);
    expect(handlerBadgeCount('consumer-a', tree, expanded, index)).toBe(1);
    expect(handlerBadgeCount('sistema-validacao', tree, expanded, index)).toBe(0);
  });

  it('macro view: a collapsed group sums its descendants', () => {
    expect(handlerBadgeCount('sistema-validacao', tree, new Set(), index)).toBe(2);
    expect(handlerBadgeCount('sistema-pedidos', tree, new Set(), index)).toBe(0);
  });
});

describe('followTrigger (SPEC §18.8)', () => {
  it('L7: e13 passes through the exchange and queue to the Consumer A handler', () => {
    expect(followTrigger(exampleDoc(), 'e13')).toEqual(['e17']);
  });

  it('L8: e14 reaches Consumer B, whose logic is not mapped', () => {
    const doc = exampleDoc();
    expect(followTrigger(doc, 'e14')).toEqual([]);
    expect(traceTrigger(doc, 'e14').unmappedNodeIds).toEqual(['consumer-b']);
  });

  it('an edge with its own handler opens it directly', () => {
    expect(followTrigger(exampleDoc(), 'e11')).toEqual(['e11']);
  });

  it('passes through gateways and ingress (worker -> CA Gateway -> ingress -> API)', () => {
    expect(followTrigger(exampleDoc(), 'e09')).toEqual(['e11']);
  });

  it('stops at the first node that runs code', () => {
    // e12 goes to a database: not a pass-through type and no handler
    expect(traceTrigger(exampleDoc(), 'e12')).toEqual({
      handlerEdgeIds: [],
      unmappedNodeIds: ['db-validacao'],
    });
  });

  it('prefers handlers of the selected flow when there are several', () => {
    const doc: SystemDoc = exampleDoc();
    // a second route from Exchange A to Consumer B, with its own handler
    doc.edges.push({ id: 'e99', source: 'exchange-a', target: 'consumer-b' });
    doc.logic?.handlers?.push({
      edgeId: 'e99',
      steps: [{ id: 'x-inicio', category: 'start', title: 'x' }],
      transitions: [],
    });
    expect(followTrigger(doc, 'e13')).toEqual(['e99', 'e17']);
    expect(followTrigger(doc, 'e13', 'fluxo-processamento')).toEqual(['e17']);
  });
});

describe('searchFields (SPEC §18.9)', () => {
  const doc = exampleDoc();
  const tree = buildTree(doc);

  it('L10: "prazo" finds pedido.prazo in the POST /validacoes handler', () => {
    const results = searchFields(doc, tree, 'prazo');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      graph: { kind: 'handler', edgeId: 'e11' },
      stepId: 'val-prazo',
      field: { name: 'pedido.prazo', role: 'write', value: '30' },
      place: { kind: 'handler', nodeName: 'API Validação', handlerName: 'POST /validacoes' },
    });
  });

  it('finds fields inside subprocesses, case- and accent-insensitive', () => {
    const results = searchFields(doc, tree, 'SCÓRE');
    expect(results.map((r) => r.stepId)).toEqual(['val-busca-pedido', 'ap-score']);
    expect(results[1]?.place).toEqual({ kind: 'subprocess', name: 'Calcula aprovação' });
  });

  it('empty query gives no results', () => {
    expect(searchFields(doc, tree, '  ')).toEqual([]);
  });

  it('graphPlace falls back to the edge label when the handler has no name', () => {
    const unnamed = exampleDoc();
    delete unnamed.logic!.handlers![1]!.name;
    expect(graphPlace(unnamed, buildTree(unnamed), { kind: 'handler', edgeId: 'e17' })).toEqual({
      kind: 'handler',
      nodeName: 'Consumer A',
      handlerName: 'consome',
    });
  });
});
