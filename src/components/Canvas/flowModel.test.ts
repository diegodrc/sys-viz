import { describe, expect, it } from 'vitest';
import { aggregateEdges } from '../../graph/aggregate';
import { buildTree } from '../../graph/tree';
import { expandAll, visibleNodeIds } from '../../graph/visibility';
import type { Boxes } from '../../graph/layout';
import { exampleDoc } from '../../test/fixtures';
import {
  buildFlowEdges,
  buildFlowNodes,
  buildFlowOverlay,
  edgeText,
  FLOW_DIM_OPACITY,
} from './flowModel';

const doc = exampleDoc();
const tree = buildTree(doc);
const edgesById = new Map(doc.edges.map((e) => [e.id, e]));

function boxesFor(expanded: ReadonlySet<string>): Boxes {
  const boxes: Boxes = {};
  for (const id of visibleNodeIds(tree, expanded))
    boxes[id] = { x: 1, y: 2, width: 220, height: 64 };
  return boxes;
}

describe('buildFlowNodes', () => {
  it('A2: macro view -> 9 card nodes with "+N" counts for groups', () => {
    const nodes = buildFlowNodes(tree, new Set(), boxesFor(new Set()), undefined);
    expect(nodes).toHaveLength(9);
    expect(nodes.every((n) => n.type === 'sysNode' && n.parentId === undefined)).toBe(true);
    expect(nodes.find((n) => n.id === 'sistema-pedidos')?.data.descendantCount).toBe(5);
  });

  it('A3/A4: expanded groups become containers with children attached by parentId', () => {
    const expanded = expandAll(tree);
    const nodes = buildFlowNodes(tree, expanded, boxesFor(expanded), 'api-pedidos');
    expect(nodes).toHaveLength(27);
    expect(nodes.find((n) => n.id === 'sistema-pedidos')?.type).toBe('sysGroup');
    expect(nodes.find((n) => n.id === 'fila-pedidos')?.parentId).toBe('db-pedidos');
    expect(nodes.find((n) => n.id === 'api-pedidos')?.selected).toBe(true);
    // parents always precede their children (React Flow requirement)
    const index = new Map(nodes.map((n, i) => [n.id, i]));
    for (const n of nodes) {
      if (n.parentId) expect(index.get(n.parentId)).toBeLessThan(index.get(n.id) ?? -1);
    }
  });

  it('A5: assumed nodes are flagged', () => {
    const expanded = expandAll(tree);
    const nodes = buildFlowNodes(tree, expanded, boxesFor(expanded), undefined);
    const assumed = nodes.filter((n) => n.data.assumed).map((n) => n.id);
    expect(assumed.sort()).toEqual([
      'ingress-pedidos',
      'ingress-portal',
      'ingress-validacao',
      'worker-pedidos',
    ]);
  });

  it('skips nodes without a box and their children', () => {
    const expanded = new Set(['sistema-pedidos']);
    const boxes = boxesFor(expanded);
    delete boxes['sistema-pedidos'];
    const ids = buildFlowNodes(tree, expanded, boxes, undefined).map((n) => n.id);
    expect(ids).not.toContain('sistema-pedidos');
    expect(ids).not.toContain('api-pedidos');
  });
});

describe('buildFlowEdges / edgeText', () => {
  it('A2: 9 edges in the macro view; ×2 for merged edges', () => {
    const rendered = aggregateEdges(doc, new Set(), tree);
    const ids = new Set(visibleNodeIds(tree, new Set()));
    const edges = buildFlowEdges(rendered, ids, edgesById, tree, undefined);
    expect(edges).toHaveLength(9);
    const publish = edges.find((e) => e.id === 'sistema-validacao->rabbitmq');
    expect(publish?.data?.text).toBe('×2');
    expect(publish?.data?.tooltip).toBe(
      'publica: API Validação → Exchange A\npublica: API Validação → Exchange B',
    );
  });

  it('A5: assumed edges get "(?)"; label falls back to protocol', () => {
    const rendered = aggregateEdges(doc, expandAll(tree), tree);
    const byId = new Map(rendered.map((e) => [e.id, e]));
    const assumed = byId.get('akamai->ingress-portal');
    const plain = byId.get('usuario->akamai');
    expect(assumed && edgeText(assumed)).toBe('HTTPS (?)');
    expect(plain && edgeText(plain)).toBe('acessa o portal');
  });
});

describe('flow overlay (SPEC §6.5)', () => {
  const flow = doc.flows!.find((f) => f.id === 'fluxo-processamento')!;
  const macro = new Set<string>();
  const rendered = aggregateEdges(doc, macro, tree);
  const ids = new Set(visibleNodeIds(tree, macro));

  it('A6: 5 highlighted edges with badges; others and off-path nodes dimmed to 30%', () => {
    const overlay = buildFlowOverlay(flow, undefined, rendered, edgesById, tree, macro);
    const edges = buildFlowEdges(rendered, ids, edgesById, tree, undefined, overlay);
    const onPath = edges.filter((e) => e.data?.flowState === 'path');
    expect(Object.fromEntries(onPath.map((e) => [e.id, e.data?.badge]))).toEqual({
      'sistema-pedidos->ca-gateway': '2',
      'ca-gateway->sistema-validacao': '3',
      'sistema-validacao->rabbitmq': '6,10',
      'rabbitmq->sistema-validacao': '8,12',
      'sistema-validacao->sistema-externo': '14',
    });
    expect(onPath.every((e) => e.animated)).toBe(true);
    expect(edges.filter((e) => e.data?.flowState === 'dimmed')).toHaveLength(4);

    const nodes = buildFlowNodes(tree, macro, boxesFor(macro), undefined, overlay);
    const dimmed = nodes.filter((n) => n.style?.opacity === FLOW_DIM_OPACITY).map((n) => n.id);
    expect(dimmed.sort()).toEqual(['akamai', 'apigee', 'portal-web', 'usuario']);
  });

  it('A8: step 6 (e13) emphasizes its aggregated rendered edge and both ends', () => {
    const overlay = buildFlowOverlay(flow, 5, rendered, edgesById, tree, macro);
    expect(overlay.currentEdgeId).toBe('sistema-validacao->rabbitmq');
    expect([...overlay.currentNodeIds].sort()).toEqual(['rabbitmq', 'sistema-validacao']);
    const edges = buildFlowEdges(rendered, ids, edgesById, tree, undefined, overlay);
    expect(edges.find((e) => e.id === 'sistema-validacao->rabbitmq')?.data?.flowState).toBe(
      'current',
    );
  });

  it('a hidden step emphasizes the collapsed node that holds it', () => {
    const overlay = buildFlowOverlay(flow, 0, rendered, edgesById, tree, macro);
    expect(overlay.currentEdgeId).toBeUndefined();
    expect([...overlay.currentNodeIds]).toEqual(['sistema-pedidos']);
  });

  it('without a flow nothing is dimmed or badged', () => {
    const edges = buildFlowEdges(rendered, ids, edgesById, tree, undefined);
    expect(edges.every((e) => e.data?.flowState === 'none' && !e.data.badge)).toBe(true);
  });
});
