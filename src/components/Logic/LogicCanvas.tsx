import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTree } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { graphOf } from '../../schema/logic';
import { levelRef, logicLayoutKey } from '../../store/appStore';
import { useApp } from '../../store/context';
import { stepStyle } from '../../theme/stepCategories';
import { useResolvedTheme } from '../../theme/useResolvedTheme';
import { LogicEdgeView } from './LogicEdgeView';
import { buildLogicEdges, buildLogicNodes, type LogicFlowNode } from './logicModel';
import { LogicStepNode } from './LogicStepNode';

const nodeTypes: NodeTypes = { logicStep: LogicStepNode };
const edgeTypes: EdgeTypes = { logicEdge: LogicEdgeView };

/** Read-only flowchart of the current trail level (SPEC §18.7). */
export function LogicCanvas() {
  const doc = useApp((s) => s.current?.doc);
  const logic = useApp((s) => s.logic);
  const layout = useApp((s) => s.logicLayout);
  const activeFlowId = useApp((s) => s.activeFlow?.id);
  const selectLogic = useApp((s) => s.selectLogic);
  const openStepSubprocess = useApp((s) => s.openStepSubprocess);
  const colorMode = useResolvedTheme(useApp((s) => s.prefs.theme));
  const { fitView } = useReactFlow();

  const level = logic?.trail.at(-1);
  const graph = doc && level ? graphOf(doc, levelRef(level)) : undefined;
  const tree = useMemo(() => (doc ? buildTree(doc) : undefined), [doc]);
  const current = layout && doc && level && layout.key === logicLayoutKey(doc.id, level);
  const boxes = current ? layout.boxes : undefined;
  const routes = current ? layout.routes : undefined;
  const selectedStepId = logic?.selection?.kind === 'step' ? logic.selection.id : undefined;
  const categories = logic?.categories;
  const pulseStepId = logic?.pulse?.stepId;

  const derivedNodes = useMemo(
    () =>
      doc && tree && graph && boxes && categories
        ? buildLogicNodes(doc, tree, graph, boxes, {
            selectedStepId,
            categories,
            pulseStepId,
            flowId: activeFlowId,
          })
        : [],
    [doc, tree, graph, boxes, categories, selectedStepId, pulseStepId, activeFlowId],
  );
  const edges = useMemo(() => {
    if (!graph || !routes) return [];
    const dimmed = new Set(derivedNodes.filter((n) => n.data.dimmed).map((n) => n.id));
    return buildLogicEdges(graph, routes, dimmed);
  }, [graph, routes, derivedNodes]);

  // React Flow keeps measured sizes in node state; store-derived nodes replace it on change
  const [local, setLocal] = useState({ source: derivedNodes, nodes: derivedNodes });
  let nodes = local.nodes;
  if (local.source !== derivedNodes) {
    nodes = derivedNodes;
    setLocal({ source: derivedNodes, nodes: derivedNodes });
  }

  const revision = current ? layout.revision : undefined;
  const nodesInitialized = useNodesInitialized();
  const fitted = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (revision === undefined || !nodesInitialized || fitted.current === revision) return;
    fitted.current = revision;
    if (pulseStepId !== undefined) {
      void fitView({ nodes: [{ id: pulseStepId }], padding: 0.8, maxZoom: 1.2 });
    } else {
      void fitView({ padding: 0.1, maxZoom: 1.2 });
    }
  }, [revision, nodesInitialized, fitView, pulseStepId]);

  if (!doc || !graph) return null;

  return (
    <div className="relative h-full w-full" role="region" aria-label={t.logic.canvasLabel}>
      <ReactFlow<LogicFlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={(changes: NodeChange<LogicFlowNode>[]) =>
          setLocal((prev) => ({ ...prev, nodes: applyNodeChanges(changes, prev.nodes) }))
        }
        onNodeClick={(_, node) => selectLogic({ kind: 'step', id: node.id })}
        onNodeDoubleClick={(_, node) => {
          if (node.data.step.subprocessId !== undefined) openStepSubprocess(node.id);
        }}
        onPaneClick={() => selectLogic(undefined)}
        nodesDraggable={false}
        nodesConnectable={false}
        colorMode={colorMode}
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={2}
        fitView
      >
        <Background gap={24} />
        <MiniMap<LogicFlowNode>
          pannable
          zoomable
          nodeColor={(node) => stepStyle(node.data.step.category, node.data.step.outcome).color}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      {!boxes && (
        <div
          role="status"
          className="sv-delayed-show pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-1 text-sm shadow"
        >
          {t.logic.computingLayout}
        </div>
      )}
    </div>
  );
}
