import { X } from 'lucide-react';
import { useMemo } from 'react';
import { aggregateEdges } from '../../graph/aggregate';
import { buildTree } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { EdgeDetails } from './EdgeDetails';
import { EdgeLinkList } from './EdgeLinkList';
import { FlowDetails } from './FlowDetails';
import { NodeDetails } from './NodeDetails';
import { SystemDetails } from './SystemDetails';

/** Right-hand panel for the current selection (SPEC §6.6); closed when nothing is selected. */
export function DetailsPanel() {
  const current = useApp((s) => s.current);
  const selection = useApp((s) => s.selection);
  const select = useApp((s) => s.select);
  const activeFlow = useApp((s) => s.activeFlow);
  const doc = current?.doc;
  const expanded = current?.expanded;
  const tree = useMemo(() => (doc ? buildTree(doc) : undefined), [doc]);
  const edgesById = useMemo(() => new Map((doc?.edges ?? []).map((e) => [e.id, e])), [doc]);
  const rendered = useMemo(
    () => (doc && tree && expanded ? aggregateEdges(doc, expanded, tree) : []),
    [doc, tree, expanded],
  );

  if (!doc || !tree || !selection) return null;
  const nameOf = (id: string): string => tree.byId.get(id)?.name ?? id;

  let title: string = t.details.kinds.system;
  let body: React.ReactNode = null;
  if (selection.kind === 'system') {
    body = <SystemDetails doc={doc} />;
  } else if (selection.kind === 'node') {
    title = t.details.kinds.node;
    body = <NodeDetails key={selection.id} doc={doc} tree={tree} nodeId={selection.id} />;
  } else if (selection.kind === 'docEdge') {
    const edge = edgesById.get(selection.id);
    title = t.details.kinds.edge;
    // SPEC §6.5: during step-by-step the panel shows the step's original edge with its note
    const flow = activeFlow && doc.flows?.find((f) => f.id === activeFlow.id);
    const step = activeFlow?.step === undefined ? undefined : flow?.steps[activeFlow.step];
    const note = step?.edgeId === selection.id ? step.note : undefined;
    body = edge ? (
      <EdgeDetails key={edge.id} doc={doc} edge={edge} tree={tree} note={note} />
    ) : null;
  } else if (selection.kind === 'flow') {
    const flow = doc.flows?.find((f) => f.id === selection.id);
    title = t.details.kinds.flow;
    body = flow ? (
      <FlowDetails key={flow.id} flow={flow} edgesById={edgesById} tree={tree} />
    ) : null;
  } else {
    const renderedEdge = rendered.find((e) => e.id === selection.id);
    const originals = (renderedEdge?.edgeIds ?? [])
      .map((id) => edgesById.get(id))
      .filter((e) => e !== undefined);
    const single = originals.length === 1 ? originals[0] : undefined;
    if (single) {
      title = t.details.kinds.edge;
      body = <EdgeDetails key={single.id} doc={doc} edge={single} tree={tree} />;
    } else if (originals.length > 1) {
      // SPEC §6.6: an aggregated edge lists its originals; editing opens the chosen one
      title = t.details.kinds.aggregated(originals.length);
      body = (
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t.details.fields.originals}
          </h3>
          <EdgeLinkList edges={originals} nameOf={nameOf} />
        </div>
      );
    }
  }

  return (
    <aside
      aria-label={t.details.panel}
      className="flex w-96 shrink-0 flex-col border-l border-border bg-surface max-[900px]:absolute max-[900px]:inset-y-0 max-[900px]:right-0 max-[900px]:z-30 max-[900px]:w-[min(24rem,100%)] max-[900px]:shadow-xl"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t.details.close}
          onClick={() => select(undefined)}
        >
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{body}</div>
    </aside>
  );
}
