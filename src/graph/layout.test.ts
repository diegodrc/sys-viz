import { describe, expect, it } from 'vitest';
import { createDirectEngine } from '../layout/engine';
import { exampleDoc } from '../test/fixtures';
import { aggregateEdges } from './aggregate';
import {
  applySavedPositions,
  buildElkGraph,
  edgeContainer,
  NODE_HEIGHT,
  NODE_WIDTH,
  readElkLayout,
  ROOT_ID,
  settleDrag,
  type Boxes,
} from './layout';
import { GROUP_PADDING } from './positions';
import { buildTree } from './tree';
import { expandAll } from './visibility';

const doc = exampleDoc();
const tree = buildTree(doc);

describe('buildElkGraph', () => {
  it('macro view: 9 leaf-sized nodes and 9 edges at the root', () => {
    const graph = buildElkGraph(tree, new Set(), aggregateEdges(doc, new Set(), tree));
    expect(graph.layoutOptions).toMatchObject({
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    });
    expect(graph.children?.map((c) => [c.id, c.width, c.height])).toHaveLength(9);
    expect(graph.children?.every((c) => c.width === NODE_WIDTH && c.height === NODE_HEIGHT)).toBe(
      true,
    );
    expect(graph.edges).toHaveLength(9);
  });

  it('expanded groups nest their children and own the edges between them (LCA)', () => {
    const expanded = new Set(['sistema-pedidos', 'db-pedidos']);
    const graph = buildElkGraph(tree, expanded, aggregateEdges(doc, expanded, tree));
    const pedidos = graph.children?.find((c) => c.id === 'sistema-pedidos');
    expect(pedidos?.layoutOptions?.['elk.padding']).toBe('[top=48,left=24,bottom=24,right=24]');
    expect(pedidos?.children?.map((c) => c.id)).toEqual([
      'ingress-pedidos',
      'api-pedidos',
      'worker-pedidos',
      'db-pedidos',
    ]);
    // ingress -> api lives inside sistema-pedidos; api -> fila-pedidos too (LCA = sistema-pedidos)
    expect(pedidos?.edges?.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        'ingress-pedidos->api-pedidos',
        'api-pedidos->fila-pedidos',
      ]) as unknown,
    );
    expect(graph.edges?.map((e) => e.id)).toContain('apigee->ingress-pedidos');
  });

  it('edgeContainer returns the root when there is no common ancestor', () => {
    expect(edgeContainer('apigee', 'api-pedidos', tree)).toBe(ROOT_ID);
    expect(edgeContainer('fila-pedidos', 'worker-pedidos', tree)).toBe('sistema-pedidos');
  });
});

describe('ELK layout of the example', () => {
  it('returns positions and sizes for all 27 nodes when everything is expanded', async () => {
    const engine = createDirectEngine();
    const expanded = expandAll(tree);
    const result = await engine(buildElkGraph(tree, expanded, aggregateEdges(doc, expanded, tree)));
    const boxes = readElkLayout(result);
    expect(Object.keys(boxes)).toHaveLength(27);
    const pedidos = boxes['sistema-pedidos'];
    const api = boxes['api-pedidos'];
    // children are relative to the group and inside its padding
    expect(api?.x).toBeGreaterThanOrEqual(GROUP_PADDING.left);
    expect(api?.y).toBeGreaterThanOrEqual(GROUP_PADDING.top);
    expect((api?.x ?? 0) + NODE_WIDTH).toBeLessThanOrEqual(pedidos?.width ?? 0);
  });

  it('lays out 300 visible nodes in reasonable time (SPEC §11: ≤ 1 s target)', async () => {
    const engine = createDirectEngine();
    const many = {
      ...doc,
      nodes: Array.from({ length: 300 }, (_, i) => ({
        id: `n${i}`,
        name: 'N',
        type: 'api' as const,
      })),
      edges: Array.from({ length: 299 }, (_, i) => ({
        id: `e${i}`,
        source: `n${i}`,
        target: `n${i + 1}`,
      })),
      flows: [],
    };
    const manyTree = buildTree(many);
    const start = performance.now();
    const result = await engine(
      buildElkGraph(manyTree, new Set(), aggregateEdges(many, new Set(), manyTree)),
    );
    const elapsed = performance.now() - start;
    expect(Object.keys(readElkLayout(result))).toHaveLength(300);
    // generous bound for CI noise; the real target is checked in the browser
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('applySavedPositions / settleDrag', () => {
  const expanded = new Set(['sistema-pedidos']);
  const base: Boxes = {
    'sistema-pedidos': { x: 500, y: 100, width: 600, height: 300 },
    'ingress-pedidos': { x: 24, y: 48, width: 220, height: 64 },
    'api-pedidos': { x: 300, y: 48, width: 220, height: 64 },
    'worker-pedidos': { x: 24, y: 160, width: 220, height: 64 },
    'db-pedidos': { x: 300, y: 160, width: 220, height: 64 },
    apigee: { x: 100, y: 100, width: 220, height: 64 },
  };

  it('saved positions override ELK and groups grow to wrap them', () => {
    const boxes = applySavedPositions(base, { 'api-pedidos': { x: 700, y: 400 } }, tree, expanded);
    expect(boxes['api-pedidos']).toMatchObject({ x: 700, y: 400 });
    expect(boxes['sistema-pedidos']).toMatchObject({
      x: 500,
      y: 100,
      width: 700 + 220 + GROUP_PADDING.right,
      height: 400 + 64 + GROUP_PADDING.bottom,
    });
  });

  it('dragging a child above/left shifts the group and persists all siblings', () => {
    const { boxes, updates } = settleDrag(base, tree, {}, 'api-pedidos', { x: -76, y: 48 });
    // group moved left by 100 so that api lands on the padding
    expect(boxes['sistema-pedidos']).toMatchObject({ x: 400, y: 100 });
    expect(updates).toEqual({
      'api-pedidos': { x: 24, y: 48 },
      'ingress-pedidos': { x: 124, y: 48 },
      'worker-pedidos': { x: 124, y: 160 },
      'db-pedidos': { x: 400, y: 160 },
    });
  });

  it('the group position is persisted on shift only if it was saved before', () => {
    const { updates } = settleDrag(
      base,
      tree,
      { 'sistema-pedidos': { x: 500, y: 100 } },
      'api-pedidos',
      {
        x: -76,
        y: 48,
      },
    );
    expect(updates['sistema-pedidos']).toEqual({ x: 400, y: 100 });
  });

  it('dragging a root node only stores that node', () => {
    expect(settleDrag(base, tree, {}, 'apigee', { x: 5, y: 6 }).updates).toEqual({
      apigee: { x: 5, y: 6 },
    });
  });
});
