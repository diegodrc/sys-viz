import { describe, expect, it } from 'vitest';
import { aggregateEdges } from '../../graph/aggregate';
import { buildTree } from '../../graph/tree';
import { expandAll, visibleNodeIds } from '../../graph/visibility';
import type { Boxes } from '../../graph/layout';
import { exampleDoc } from '../../test/fixtures';
import { buildFlowEdges, buildFlowNodes, edgeText } from './flowModel';

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
