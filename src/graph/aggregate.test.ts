import { describe, expect, it } from 'vitest';
import type { SystemDoc } from '../schema/system';
import { exampleDoc } from '../test/fixtures';
import { aggregateEdges, type RenderedEdge } from './aggregate';
import { buildTree } from './tree';
import { expandAll } from './visibility';

const doc = exampleDoc();
const tree = buildTree(doc);

function pairs(edges: RenderedEdge[]): string[] {
  return edges.map((e) => e.id);
}

function byId(edges: RenderedEdge[], id: string): RenderedEdge {
  const edge = edges.find((e) => e.id === id);
  if (!edge) throw new Error(`rendered edge ${id} not found`);
  return edge;
}

describe('aggregateEdges (SPEC §5.4)', () => {
  it('A2: macro view has exactly 9 rendered edges', () => {
    const edges = aggregateEdges(doc, new Set(), tree);
    expect(pairs(edges)).toEqual([
      'usuario->akamai',
      'akamai->portal-web',
      'portal-web->apigee',
      'apigee->sistema-pedidos',
      'sistema-pedidos->ca-gateway',
      'ca-gateway->sistema-validacao',
      'sistema-validacao->rabbitmq',
      'rabbitmq->sistema-validacao',
      'sistema-validacao->sistema-externo',
    ]);
    expect(byId(edges, 'sistema-validacao->rabbitmq').edgeIds).toEqual(['e13', 'e14']);
    expect(byId(edges, 'rabbitmq->sistema-validacao').edgeIds).toEqual(['e17', 'e18']);
  });

  it('A3: expanding sistema-pedidos gives 12 rendered edges', () => {
    const edges = aggregateEdges(doc, new Set(['sistema-pedidos']), tree);
    expect(edges).toHaveLength(12);
    expect(pairs(edges)).toEqual(
      expect.arrayContaining([
        'apigee->ingress-pedidos',
        'ingress-pedidos->api-pedidos',
        'api-pedidos->db-pedidos',
        'db-pedidos->worker-pedidos',
        'worker-pedidos->ca-gateway',
      ]) as unknown,
    );
  });

  it('A4: expand all gives 21 rendered edges, none aggregated', () => {
    const edges = aggregateEdges(doc, expandAll(tree), tree);
    expect(edges).toHaveLength(21);
    expect(edges.every((e) => !e.aggregated && e.edgeIds.length === 1)).toBe(true);
  });

  it('hides edges internal to a collapsed node', () => {
    const edges = aggregateEdges(doc, new Set(), tree);
    const all = edges.flatMap((e) => e.edgeIds);
    // e03 is ingress-portal -> frontend-portal, both inside the collapsed portal-web
    expect(all).not.toContain('e03');
    expect(all).not.toContain('e15');
  });

  it('×N groups: async only if all async, assumed only if all assumed, no label', () => {
    const edges = aggregateEdges(doc, new Set(), tree);
    const publish = byId(edges, 'sistema-validacao->rabbitmq');
    expect(publish).toMatchObject({
      aggregated: true,
      async: true,
      assumed: false,
      label: undefined,
    });

    // akamai -> portal-web holds only e02 (assumed): single edge keeps its style
    const cdn = byId(edges, 'akamai->portal-web');
    expect(cdn).toMatchObject({ aggregated: false, assumed: true, async: false });
  });

  it('mixed modes and confidence are not dashed nor assumed', () => {
    const mixed: SystemDoc = {
      ...doc,
      edges: [
        { id: 'x1', source: 'apigee', target: 'api-pedidos', mode: 'async', confidence: 'assumed' },
        { id: 'x2', source: 'apigee', target: 'worker-pedidos', mode: 'sync' },
      ],
    };
    const [edge] = aggregateEdges(mixed, new Set());
    expect(edge).toMatchObject({ id: 'apigee->sistema-pedidos', async: false, assumed: false });
  });

  it('single edge label falls back to protocol, then nothing', () => {
    const edges = aggregateEdges(doc, expandAll(tree), tree);
    expect(byId(edges, 'usuario->akamai').label).toBe('acessa o portal');
    expect(byId(edges, 'akamai->ingress-portal').label).toBe('HTTPS');
    const bare: SystemDoc = { ...doc, edges: [{ id: 'b', source: 'usuario', target: 'akamai' }] };
    expect(aggregateEdges(bare, new Set())[0]?.label).toBeUndefined();
  });

  it('opposite pairs are distinct rendered edges', () => {
    const edges = aggregateEdges(doc, new Set(), tree);
    expect(byId(edges, 'sistema-validacao->rabbitmq')).not.toBe(
      byId(edges, 'rabbitmq->sistema-validacao'),
    );
  });

  it('does not mutate the document', () => {
    const before = JSON.stringify(doc);
    aggregateEdges(doc, expandAll(tree), tree);
    expect(JSON.stringify(doc)).toBe(before);
  });
});
