import { describe, expect, it } from 'vitest';
import { createDirectEngine } from '../layout/engine';
import { exampleDoc } from '../test/fixtures';
import {
  buildLogicElkGraph,
  DECISION_HEIGHT,
  readLogicLayout,
  STEP_HEIGHT,
  STEP_WIDTH,
  transitionId,
} from './logicLayout';

const handler = exampleDoc().logic!.handlers![0]!;

describe('buildLogicElkGraph (SPEC §18.7)', () => {
  it('lays out top to bottom with one node per step and one edge per transition', () => {
    const graph = buildLogicElkGraph(handler);
    expect(graph.layoutOptions).toMatchObject({
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
    });
    expect(graph.children).toHaveLength(11);
    expect(graph.edges).toHaveLength(11);
    expect(graph.children?.find((c) => c.id === 'val-campos')).toMatchObject({
      width: STEP_WIDTH,
      height: STEP_HEIGHT,
    });
    expect(graph.children?.find((c) => c.id === 'val-campos-ok')?.height).toBe(DECISION_HEIGHT);
  });

  it('gives decision exits a label so ELK leaves room for it', () => {
    const graph = buildLogicElkGraph(handler);
    const exit = graph.edges?.find((e) => e.id === transitionId(2));
    expect(exit?.sources).toEqual(['val-campos-ok']);
    expect(exit?.labels?.[0]?.text).toBe('não');
    expect(graph.edges?.find((e) => e.id === transitionId(0))?.labels).toBeUndefined();
  });

  it('runs in ELK: the start is above the end and every transition has a route', async () => {
    const result = await createDirectEngine()(buildLogicElkGraph(handler));
    const { boxes, routes } = readLogicLayout(result);
    expect(Object.keys(boxes)).toHaveLength(11);
    expect(boxes['val-inicio']!.y).toBeLessThan(boxes['val-fim']!.y);
    expect(Object.keys(routes)).toHaveLength(11);
  });
});
