import type { ElkNode } from 'elkjs/lib/elk-api';

/** Runs ELK on a graph. The browser uses a Web Worker; tests call elkjs directly. */
export type LayoutEngine = (graph: ElkNode) => Promise<ElkNode>;

export interface WorkerRequest {
  id: number;
  graph: ElkNode;
}

export type WorkerResponse =
  { id: number; ok: true; graph: ElkNode } | { id: number; ok: false; error: string };

/** ELK on the main thread (tests and environments without workers); loaded on first use. */
export function createDirectEngine(): LayoutEngine {
  let elk: Promise<{ layout: LayoutEngine }> | undefined;
  return async (graph) => {
    elk ??= import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => new ELK());
    return (await elk).layout(graph);
  };
}
