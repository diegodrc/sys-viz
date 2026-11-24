// Web Worker running ELK off the main thread (SPEC §5.5). Bundled inline via `?worker&inline`
// so it also works in the single-file build.
import ELK from 'elkjs/lib/elk.bundled.js';
import type { WorkerRequest, WorkerResponse } from './engine';

const elk = new ELK();
const scope = self as unknown as DedicatedWorkerGlobalScope; // worker global, typed for postMessage

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, graph } = event.data;
  elk.layout(graph).then(
    (result) => {
      const response: WorkerResponse = { id, ok: true, graph: result };
      scope.postMessage(response);
    },
    (cause: unknown) => {
      const response: WorkerResponse = { id, ok: false, error: String(cause) };
      scope.postMessage(response);
    },
  );
};
