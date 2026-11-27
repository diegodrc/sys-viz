import { Link2, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildLogicIndex } from '../../graph/logic';
import type { TreeIndex } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { draftToGraphInfo, graphInfoToDraft, type GraphInfoDraft } from '../../schema/editLogic';
import { graphOf, handlerName, type GraphRef } from '../../schema/logic';
import type { SystemDoc } from '../../schema/system';
import { useApp } from '../../store/context';
import { FieldRow } from '../DetailsPanel/FieldRow';
import { FormField } from '../DetailsPanel/FormField';
import { IdRow } from '../DetailsPanel/IdRow';
import { LogicUsageList } from '../DetailsPanel/LogicUsageList';

interface Props {
  doc: SystemDoc;
  tree: TreeIndex;
  graph: GraphRef;
}

function GraphForm({
  doc,
  graph,
  onDone,
}: {
  doc: SystemDoc;
  graph: GraphRef;
  onDone: () => void;
}) {
  const updateGraphInfo = useApp((s) => s.updateGraphInfo);
  const found = graphOf(doc, graph);
  const [draft, setDraft] = useState<GraphInfoDraft>(() =>
    found ? graphInfoToDraft(found) : { name: '', description: '' },
  );
  const result = draftToGraphInfo(graph, draft);
  const errors = result.ok ? {} : result.errors;
  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (result.ok && updateGraphInfo(graph, result.value)) onDone();
      }}
    >
      <FormField label={t.details.fields.name} error={errors.name}>
        <input
          className="field"
          data-autofocus
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </FormField>
      <FormField label={t.details.fields.description} error={errors.description}>
        <textarea
          className="field min-h-20"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />
      </FormField>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn" onClick={onDone}>
          {t.common.cancel}
        </button>
        <button type="submit" className="btn btn-primary" disabled={!result.ok}>
          {t.common.save}
        </button>
      </div>
    </form>
  );
}

/** The open handler or subprocess (SPEC §18.7): name, description and where it is used. */
export function GraphDetails({ doc, tree, graph }: Props) {
  const showEdgeOnMap = useApp((s) => s.showEdgeOnMap);
  const focusNode = useApp((s) => s.focusNode);
  const closeLogic = useApp((s) => s.closeLogic);
  const [editing, setEditing] = useState(false);
  const index = useMemo(() => buildLogicIndex(doc), [doc]);
  const found = graphOf(doc, graph);
  if (!found) return null;
  if (editing) return <GraphForm doc={doc} graph={graph} onDone={() => setEditing(false)} />;

  const f = t.logic.fields;
  let links: React.ReactNode;
  if (graph.kind === 'handler') {
    const edge = doc.edges.find((e) => e.id === graph.edgeId);
    const node = edge ? tree.byId.get(edge.target) : undefined;
    links = (
      <>
        <FieldRow label={f.handlerEdge}>
          {edge && (
            <button
              type="button"
              className="flex items-center gap-1 rounded px-1 text-left text-accent hover:bg-surface-muted"
              onClick={() => showEdgeOnMap(edge.id)}
            >
              <Link2 size={14} aria-hidden />
              {t.logic.showEdge(edge.label ?? edge.protocol ?? edge.id)}
            </button>
          )}
        </FieldRow>
        <FieldRow label={f.node}>
          {node && (
            <button
              type="button"
              className="rounded px-1 text-left text-accent hover:bg-surface-muted"
              onClick={() => {
                closeLogic();
                focusNode(node.id);
              }}
            >
              {node.name}
            </button>
          )}
        </FieldRow>
      </>
    );
  } else {
    links = (
      <div className="py-1.5">
        <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {t.logic.usedInSubprocess}
        </h3>
        <LogicUsageList
          doc={doc}
          tree={tree}
          usages={index.usagesOfSubprocess.get(graph.id) ?? []}
          empty={t.details.noItems}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" className="btn" onClick={() => setEditing(true)}>
          <Pencil size={14} aria-hidden />
          {t.details.edit}
        </button>
      </div>
      <dl>
        {graph.kind === 'subprocess' && <IdRow id={graph.id} />}
        <FieldRow label={t.details.fields.name}>
          {graph.kind === 'handler' && 'edgeId' in found ? handlerName(doc, found) : found.name}
        </FieldRow>
        <FieldRow label={t.details.fields.description}>{found.description}</FieldRow>
        <FieldRow label={t.details.fields.steps}>{String(found.steps.length)}</FieldRow>
        {links}
      </dl>
    </div>
  );
}
