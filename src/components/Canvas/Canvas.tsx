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
import { filterDimmedEdges, filterDimmedNodes } from '../../graph/filter';
import { stepLocation } from '../../graph/flowPath';
import { buildTree } from '../../graph/tree';
import { visibleNodeIds } from '../../graph/visibility';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { NODE_TYPE_STYLES } from '../../theme/nodeTypes';
import { useResolvedTheme } from '../../theme/useResolvedTheme';
import { SysEdgeView } from '../edges/SysEdgeView';
import { FlowBar } from '../FlowBar/FlowBar';
import { GroupNode } from '../nodes/GroupNode';
import { SysNodeCard } from '../nodes/SysNodeCard';
import { buildFlowEdges, buildFlowNodes, buildFlowOverlay, type SysFlowNode } from './flowModel';

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
  const activeFlow = useApp((s) => s.activeFlow);
  const filters = useApp((s) => s.filters);
  const pulse = useApp((s) => s.pulse);
  const colorMode = useResolvedTheme(useApp((s) => s.prefs.theme));
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

  const flow = activeFlow && doc?.flows?.find((f) => f.id === activeFlow.id);
  const step = activeFlow?.step;
  const overlay = useMemo(
    () =>
      flow && tree && expanded
        ? buildFlowOverlay(flow, step, rendered, edgesById, tree, expanded)
        : undefined,
    [flow, step, rendered, edgesById, tree, expanded],
  );

  // SPEC §6.4 filters: dimmed nodes (groups stay lit if a descendant matches) and edges
  const filterDimmed = useMemo(() => {
    if (!tree || !expanded) return { nodes: new Set<string>(), edges: new Set<string>() };
    const dimmedNodes = filterDimmedNodes(tree, visibleNodeIds(tree, expanded), filters);
    return { nodes: dimmedNodes, edges: filterDimmedEdges(rendered, dimmedNodes) };
  }, [tree, expanded, filters, rendered]);
  const pulseId = pulse?.id;

  const derivedNodes = useMemo(
    () =>
      tree && expanded && boxes
        ? buildFlowNodes(tree, expanded, boxes, selectedNode, overlay, {
            filterDimmed: filterDimmed.nodes,
            ...(pulseId !== undefined ? { pulseId } : {}),
          })
        : [],
    [tree, expanded, boxes, selectedNode, overlay, filterDimmed, pulseId],
  );
  const edges = useMemo(() => {
    if (!tree) return [];
    const ids = new Set(derivedNodes.map((n) => n.id));
    return buildFlowEdges(
      rendered,
      ids,
      edgesById,
      tree,
      selectedEdge,
      overlay,
      filterDimmed.edges,
    );
  }, [rendered, derivedNodes, edgesById, tree, selectedEdge, overlay, filterDimmed]);

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

  // SPEC §6.4: center the search result once it is laid out and measured
  const pulseToken = pulse?.token;
  const pulseRendered = pulseId !== undefined && derivedNodes.some((n) => n.id === pulseId);
  useEffect(() => {
    if (pulseId === undefined || !pulseRendered || !nodesInitialized) return;
    void fitView({ nodes: [{ id: pulseId }], padding: 0.6, maxZoom: 1.2, duration: 300 });
  }, [pulseId, pulseToken, pulseRendered, nodesInitialized, fitView]);

  // SPEC §6.5: the canvas centers on the current step (its edge ends, or the node holding it)
  const focusIds = overlay ? [...overlay.currentNodeIds].sort().join('|') : '';
  useEffect(() => {
    if (step === undefined || focusIds === '' || !nodesInitialized) return;
    void fitView({
      nodes: focusIds.split('|').map((id) => ({ id })),
      padding: 0.4,
      maxZoom: 1.2,
      duration: 300,
    });
  }, [step, focusIds, nodesInitialized, fitView]);

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
        colorMode={colorMode}
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
      <FlowBar />
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
