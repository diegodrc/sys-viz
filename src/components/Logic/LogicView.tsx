import { ReactFlowProvider } from '@xyflow/react';
import { LogicCanvas } from './LogicCanvas';
import { LogicHeader } from './LogicHeader';

/** Logic drill-down (SPEC §18.7): replaces the map canvas while a logic trail is open. */
export function LogicView() {
  return (
    <div className="flex h-full flex-col">
      <LogicHeader />
      <div className="relative min-h-0 flex-1">
        <ReactFlowProvider>
          <LogicCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
