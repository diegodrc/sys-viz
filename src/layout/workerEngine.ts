import type { LayoutEngine, WorkerRequest, WorkerResponse } from './engine';
import ElkWorker from './elk.worker?worker&inline';

/** ELK in an inline Web Worker; one worker for the app, requests matched by id. */
export function createWorkerEngine(): LayoutEngine {
  const worker = new ElkWorker();
  const pending = new Map<
    number,
    { resolve: (g: WorkerRequest['graph']) => void; reject: (e: Error) => void }
  >();
  let nextId = 1;

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) entry.resolve(response.graph);
    else entry.reject(new Error(response.error));
  };

  return (graph) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      const request: WorkerRequest = { id, graph };
      worker.postMessage(request);
    });
}
