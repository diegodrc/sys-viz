import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { aggregateEdges } from '../../graph/aggregate';
import { stepLocation } from '../../graph/flowPath';
import { buildTree } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { NODE_TYPE_STYLES } from '../../theme/nodeTypes';
import { SysEdgeView } from '../edges/SysEdgeView';
import { GroupNode } from '../nodes/GroupNode';
import { SysNodeCard } from '../nodes/SysNodeCard';
import { buildFlowEdges, buildFlowNodes, type SysFlowNode } from './flowModel';

const nodeTypes: NodeTypes = { sysNode: SysNodeCard, sysGroup: GroupNode };
const edgeTypes: EdgeTypes = { sysEdge: SysEdgeView };

function CanvasInner() {
  const current = useApp((s) => s.current);
  const layout = useApp((s) => s.layout);
  const layoutPending = useApp((s) => s.layoutPending);
  const selection = useApp((s) => s.selection);
  const select = useApp((s) => s.select);
  const toggleExpanded = useApp((s) => s.toggleExpanded);
  const dropNode = useApp((s) => s.dropNode);
  const { fitView } = useReactFlow();

  const doc = current?.doc;
  const expanded = current?.expanded;
  const tree = useMemo(() => (doc ? buildTree(doc) : undefined), [doc]);
  const rendered = useMemo(
    () => (doc && tree && expanded ? aggregateEdges(doc, expanded, tree) : []),
    [doc, tree, expanded],
  );
  const edgesById = useMemo(() => new Map((doc?.edges ?? []).map((e) => [e.id, e])), [doc]);
  const boxes = layout && doc && layout.docId === doc.id ? layout.boxes : undefined;
  const selectedNode = selection?.kind === 'node' ? selection.id : undefined;
  // an original edge selected in the panel highlights the rendered edge that contains it
  const selectedEdge = useMemo(() => {
    if (selection?.kind === 'edge') return selection.id;
    if (selection?.kind !== 'docEdge' || !tree || !expanded) return undefined;
    const location = stepLocation(edgesById.get(selection.id), tree, expanded);
    return location.kind === 'rendered' ? location.renderedEdgeId : undefined;
  }, [selection, tree, expanded, edgesById]);

  const derivedNodes = useMemo(
    () => (tree && expanded && boxes ? buildFlowNodes(tree, expanded, boxes, selectedNode) : []),
    [tree, expanded, boxes, selectedNode],
  );
  const edges = useMemo(() => {
    if (!tree) return [];
    const ids = new Set(derivedNodes.map((n) => n.id));
    return buildFlowEdges(rendered, ids, edgesById, tree, selectedEdge);
  }, [rendered, derivedNodes, edgesById, tree, selectedEdge]);

  // React Flow owns transient drag state; store-derived nodes replace it whenever they change
  // (state derived during render instead of an effect, to avoid a cascading re-render)
  const [local, setLocal] = useState({ source: derivedNodes, nodes: derivedNodes });
  let nodes = local.nodes;
  if (local.source !== derivedNodes) {
    nodes = derivedNodes;
    setLocal({ source: derivedNodes, nodes: derivedNodes });
  }

  // SPEC §5.6: fit the view after each automatic layout, once React Flow has measured the nodes
  const revision = layout?.revision;
  const nodesInitialized = useNodesInitialized();
  const fittedRevision = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (revision === undefined || !nodesInitialized || fittedRevision.current === revision) return;
    fittedRevision.current = revision;
    void fitView({ padding: 0.1 });
  }, [revision, nodesInitialized, fitView]);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-text-muted">
        {t.canvas.noSystem}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full" aria-label={t.canvas.label} role="region">
      <ReactFlow<SysFlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={(changes: NodeChange<SysFlowNode>[]) =>
          setLocal((prev) => ({ ...prev, nodes: applyNodeChanges(changes, prev.nodes) }))
        }
        onNodeClick={(_, node) => select({ kind: 'node', id: node.id })}
        onEdgeClick={(_, edge) => select({ kind: 'edge', id: edge.id })}
        onPaneClick={() => select(undefined)}
        onNodeDoubleClick={(_, node) => {
          if (node.data.isGroup) toggleExpanded(node.id);
        }}
        onNodeDragStop={(_, node) => dropNode(node.id, node.position)}
        nodesConnectable={false}
        edgesFocusable
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={2}
        fitView
      >
        <Background gap={24} />
        <MiniMap<SysFlowNode>
          pannable
          zoomable
          nodeColor={(node) => NODE_TYPE_STYLES[node.data.type].color}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      {layoutPending && (
        <div
          role="status"
          className="sv-delayed-show pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-1 text-sm shadow"
        >
          {t.canvas.computingLayout}
        </div>
      )}
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
