import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { draftToSystemInfo, systemToDraft, type SystemDraft } from '../../schema/edit';
import type { SystemDoc } from '../../schema/system';
import { useApp } from '../../store/context';
import { FieldRow } from './FieldRow';
import { FormField } from './FormField';
import { IdRow } from './IdRow';

/** System: editable name/description (SPEC §6.6 "Detalhes do sistema"). */
export function SystemDetails({ doc }: { doc: SystemDoc }) {
  const updateSystemInfo = useApp((s) => s.updateSystemInfo);
  const [draft, setDraft] = useState<SystemDraft | null>(null);
  const f = t.details.fields;

  if (draft) {
    const result = draftToSystemInfo(draft);
    const errors = result.ok ? {} : result.errors;
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (result.ok && updateSystemInfo(result.value)) setDraft(null);
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
        <FormField label={f.description}>
          <textarea
            className="field min-h-24"
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
        <button type="button" className="btn" onClick={() => setDraft(systemToDraft(doc))}>
          <Pencil size={14} aria-hidden />
          {t.details.edit}
        </button>
      </div>
      <dl>
        <IdRow id={doc.id} />
        <FieldRow label={f.name}>{doc.name}</FieldRow>
        <FieldRow label={f.description}>{doc.description}</FieldRow>
        <FieldRow label={f.schemaVersion}>{String(doc.schemaVersion)}</FieldRow>
      </dl>
    </div>
  );
}
