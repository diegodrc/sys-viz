import { Pencil, Workflow } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildLogicIndex } from '../../graph/logic';
import type { TreeIndex } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import type { SysEdge, SystemDoc } from '../../schema/system';
import { useApp } from '../../store/context';
import { EdgeForm } from './EdgeForm';
import { FieldRow } from './FieldRow';
import { IdRow } from './IdRow';
import { LogicUsageList } from './LogicUsageList';

interface Props {
  doc: SystemDoc;
  edge: SysEdge;
  tree: TreeIndex;
  /** Optional step note shown above the fields (flow step navigation, SPEC §6.5). */
  note?: string | undefined;
}

/** One original edge: read mode and "Editar" (SPEC §6.6). */
export function EdgeDetails({ doc, edge, tree, note }: Props) {
  const focusNode = useApp((s) => s.focusNode);
  const openLogic = useApp((s) => s.openLogic);
  const logic = useMemo(() => buildLogicIndex(doc), [doc]);
  const hasHandler = logic.handlersByEdge.has(edge.id);
  const [editing, setEditing] = useState(false);
  const f = t.details.fields;
  const nameOf = (id: string): string => tree.byId.get(id)?.name ?? id;

  if (editing) return <EdgeForm key={edge.id} edge={edge} onDone={() => setEditing(false)} />;

  const endpoint = (id: string) => (
    <button
      type="button"
      className="rounded px-1 text-left text-accent hover:bg-surface-muted"
      onClick={() => focusNode(id)}
    >
      {nameOf(id)}
    </button>
  );

  return (
    <div>
      {note && <p className="mb-2 rounded-md bg-surface-muted p-2 text-sm">{note}</p>}
      <div className="flex justify-end gap-2">
        {hasHandler && (
          <button type="button" className="btn btn-primary" onClick={() => openLogic(edge.id)}>
            <Workflow size={14} aria-hidden />
            {t.logic.open}
          </button>
        )}
        <button type="button" className="btn" onClick={() => setEditing(true)}>
          <Pencil size={14} aria-hidden />
          {t.details.edit}
        </button>
      </div>
      <dl>
        <IdRow id={edge.id} />
        <FieldRow label={f.source}>{endpoint(edge.source)}</FieldRow>
        <FieldRow label={f.target}>{endpoint(edge.target)}</FieldRow>
        <FieldRow label={f.protocol}>{edge.protocol}</FieldRow>
        <FieldRow label={f.mode}>
          {edge.mode ? t.details.modes[edge.mode] : t.details.modes.unset}
        </FieldRow>
        <FieldRow label={f.label}>{edge.label}</FieldRow>
        <FieldRow label={f.description}>{edge.description}</FieldRow>
        <FieldRow label={f.metadata}>
          {edge.metadata && Object.keys(edge.metadata).length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-2">
              {Object.entries(edge.metadata).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-xs text-text-muted">{key}</dt>
                  <dd className="text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </FieldRow>
        <FieldRow label={f.confidence}>
          {edge.confidence === 'assumed'
            ? t.details.confidence.assumed
            : t.details.confidence.confirmed}
        </FieldRow>
      </dl>
      <h3 className="mt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        {t.logic.usedIn}
      </h3>
      <LogicUsageList
        doc={doc}
        tree={tree}
        usages={logic.usagesOfEdge.get(edge.id) ?? []}
        empty={t.logic.noUsages}
      />
    </div>
  );
}
