import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { draftToEdge, edgeToDraft, type EdgeDraft } from '../../schema/edit';
import type { SysEdge } from '../../schema/system';
import { useApp } from '../../store/context';
import { FormField } from './FormField';
import { PairsEditor } from './PairsEditor';

interface Props {
  edge: SysEdge;
  onDone: () => void;
}

/** Edge edit form: protocol, mode, label, description, metadata, confidence (SPEC §6.6). */
export function EdgeForm({ edge, onDone }: Props) {
  const updateEdge = useApp((s) => s.updateEdge);
  const [draft, setDraft] = useState<EdgeDraft>(() => edgeToDraft(edge));
  const result = draftToEdge(edge, draft);
  const errors = result.ok ? {} : result.errors;
  const set = (patch: Partial<EdgeDraft>): void => setDraft((d) => ({ ...d, ...patch }));
  const f = t.details.fields;

  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (result.ok && updateEdge(result.value)) onDone();
      }}
    >
      <FormField label={f.protocol} error={errors.protocol}>
        <input
          className="field"
          data-autofocus
          value={draft.protocol}
          onChange={(e) => set({ protocol: e.target.value })}
        />
      </FormField>
      <FormField label={f.mode} error={errors.mode}>
        <select
          className="field"
          value={draft.mode}
          onChange={(e) => set({ mode: e.target.value as EdgeDraft['mode'] })} // fixed options
        >
          <option value="">{t.details.modes.unset}</option>
          <option value="sync">{t.details.modes.sync}</option>
          <option value="async">{t.details.modes.async}</option>
        </select>
      </FormField>
      <FormField label={f.label} error={errors.label}>
        <input
          className="field"
          value={draft.label}
          onChange={(e) => set({ label: e.target.value })}
        />
      </FormField>
      <FormField label={f.description} error={errors.description}>
        <textarea
          className="field min-h-20"
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </FormField>
      <PairsEditor
        legend={f.metadata}
        keyLabel={f.metadataKey}
        valueLabel={f.metadataValue}
        addLabel={t.details.addMetadata}
        prefix="metadata"
        keyPath="key"
        valuePath="value"
        rows={draft.metadata}
        errors={errors}
        onChange={(metadata) => set({ metadata })}
      />
      <label className="flex items-center gap-2 py-2 text-sm">
        <input
          type="checkbox"
          checked={draft.assumed}
          onChange={(e) => set({ assumed: e.target.checked })}
        />
        {t.details.confidence.assumed}
      </label>
      {!result.ok && <p className="pb-1 text-xs text-danger">{t.edit.invalidForm}</p>}
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
