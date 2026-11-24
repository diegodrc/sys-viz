import { Pencil } from 'lucide-react';
import { useState } from 'react';
import type { TreeIndex } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { draftToFlow, flowToDraft, type FlowDraft } from '../../schema/edit';
import type { Flow, SysEdge } from '../../schema/system';
import { useApp } from '../../store/context';
import { EdgeLinkList } from './EdgeLinkList';
import { FieldRow } from './FieldRow';
import { FormField } from './FormField';
import { IdRow } from './IdRow';

interface Props {
  flow: Flow;
  edgesById: ReadonlyMap<string, SysEdge>;
  tree: TreeIndex;
}

/** Flow: editable name/description, read-only numbered steps (SPEC §6.6). */
export function FlowDetails({ flow, edgesById, tree }: Props) {
  const updateFlow = useApp((s) => s.updateFlow);
  const [draft, setDraft] = useState<FlowDraft | null>(null);
  const f = t.details.fields;
  const nameOf = (id: string): string => tree.byId.get(id)?.name ?? id;
  const steps = flow.steps.filter((s) => edgesById.has(s.edgeId));
  const stepEdges = steps.map((s) => edgesById.get(s.edgeId)).filter((e): e is SysEdge => !!e);

  if (draft) {
    const result = draftToFlow(flow, draft);
    const errors = result.ok ? {} : result.errors;
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (result.ok && updateFlow(result.value)) setDraft(null);
        }}
      >
        <FormField label={f.name} error={errors.name}>
          <input
            className="field"
            data-autofocus
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </FormField>
        <FormField label={f.description} error={errors.description}>
          <textarea
            className="field min-h-20"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn" onClick={() => setDraft(null)}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!result.ok}>
            {t.common.save}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" className="btn" onClick={() => setDraft(flowToDraft(flow))}>
          <Pencil size={14} aria-hidden />
          {t.details.edit}
        </button>
      </div>
      <dl>
        <IdRow id={flow.id} />
        <FieldRow label={f.name}>{flow.name}</FieldRow>
        <FieldRow label={f.description}>{flow.description}</FieldRow>
      </dl>
      <h3 className="mt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        {f.steps}
      </h3>
      <EdgeLinkList edges={stepEdges} nameOf={nameOf} numbered notes={steps.map((s) => s.note)} />
    </div>
  );
}
