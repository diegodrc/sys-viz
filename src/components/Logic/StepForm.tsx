import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { draftToStep, stepToDraft, type FieldDraft, type StepDraft } from '../../schema/editLogic';
import type { GraphRef } from '../../schema/logic';
import { FIELD_ROLES, STEP_CATEGORIES, type LogicStep } from '../../schema/system';
import { useApp } from '../../store/context';
import { FormField } from '../DetailsPanel/FormField';
import { PairsEditor } from '../DetailsPanel/PairsEditor';

interface Props {
  graph: GraphRef;
  step: LogicStep;
  onDone: () => void;
}

const EMPTY_FIELD: FieldDraft = { name: '', role: 'read', rule: '', value: '', errorCode: '' };

/**
 * Step edit form (SPEC §18.7): title, category, outcome (end only), description, technical
 * detail, fields, metadata and confidence. Ids, edges, subprocesses and transitions stay fixed.
 */
export function StepForm({ graph, step, onDone }: Props) {
  const updateLogicStep = useApp((s) => s.updateLogicStep);
  const [draft, setDraft] = useState<StepDraft>(() => stepToDraft(step));
  const result = draftToStep(step, draft);
  const errors = result.ok ? {} : result.errors;
  const set = (patch: Partial<StepDraft>): void => setDraft((d) => ({ ...d, ...patch }));
  const setField = (index: number, patch: Partial<FieldDraft>): void =>
    set({ fields: draft.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) });
  const f = t.logic.fields;

  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (result.ok && updateLogicStep(graph, result.value)) onDone();
      }}
    >
      <FormField label={f.title} error={errors.title}>
        <input
          className="field"
          data-autofocus
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </FormField>
      <FormField label={f.category} error={errors.category}>
        <select
          className="field"
          value={draft.category}
          onChange={(e) => set({ category: e.target.value as StepDraft['category'] })} // fixed options
        >
          {STEP_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t.logic.categories[category]}
            </option>
          ))}
        </select>
      </FormField>
      {draft.category === 'end' && (
        <FormField label={f.outcome} error={errors.outcome}>
          <select
            className="field"
            value={draft.outcome === '' ? 'success' : draft.outcome}
            onChange={(e) => set({ outcome: e.target.value as StepDraft['outcome'] })} // fixed options
          >
            <option value="success">{t.logic.outcomes.success}</option>
            <option value="error">{t.logic.outcomes.error}</option>
          </select>
        </FormField>
      )}
      <FormField label={t.details.fields.description} error={errors.description}>
        <textarea
          className="field min-h-16"
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </FormField>
      <FormField label={f.technical} error={errors.technical}>
        <textarea
          className="field min-h-16 font-mono text-xs"
          value={draft.technical}
          onChange={(e) => set({ technical: e.target.value })}
        />
      </FormField>
      <fieldset className="py-1">
        <legend className="text-xs font-medium text-text-muted">{f.fields}</legend>
        {draft.fields.length === 0 && (
          <p className="text-sm text-text-muted">{t.details.noItems}</p>
        )}
        <ul className="flex flex-col gap-2">
          {draft.fields.map((field, i) => {
            const nameError = errors[`fields.${i}.name`];
            return (
              <li key={i} className="rounded-md border border-border p-1.5">
                <div className="flex items-center gap-1">
                  <input
                    className="field min-w-0 flex-1 font-mono"
                    aria-label={`${f.fieldName} ${i + 1}`}
                    aria-invalid={nameError ? true : undefined}
                    value={field.name}
                    onChange={(e) => setField(i, { name: e.target.value })}
                  />
                  <select
                    className="field w-24"
                    aria-label={`${f.fieldRole} ${i + 1}`}
                    value={field.role}
                    onChange={(e) => setField(i, { role: e.target.value as FieldDraft['role'] })} // fixed options
                  >
                    {FIELD_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {t.logic.roles[role]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t.logic.removeField(i + 1)}
                    onClick={() => set({ fields: draft.fields.filter((_, j) => j !== i) })}
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
                {nameError && <p className="text-xs text-danger">{nameError}</p>}
                <div className="mt-1 grid grid-cols-3 gap-1">
                  <input
                    className="field"
                    aria-label={`${f.fieldRule} ${i + 1}`}
                    placeholder={f.fieldRule}
                    value={field.rule}
                    onChange={(e) => setField(i, { rule: e.target.value })}
                  />
                  <input
                    className="field"
                    aria-label={`${f.fieldValue} ${i + 1}`}
                    placeholder={f.fieldValue}
                    value={field.value}
                    onChange={(e) => setField(i, { value: e.target.value })}
                  />
                  <input
                    className="field"
                    aria-label={`${f.fieldError} ${i + 1}`}
                    placeholder={f.fieldError}
                    value={field.errorCode}
                    onChange={(e) => setField(i, { errorCode: e.target.value })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="btn mt-1"
          onClick={() => set({ fields: [...draft.fields, { ...EMPTY_FIELD }] })}
        >
          <Plus size={14} aria-hidden />
          {t.logic.addField}
        </button>
      </fieldset>
      <PairsEditor
        legend={t.details.fields.metadata}
        keyLabel={t.details.fields.metadataKey}
        valueLabel={t.details.fields.metadataValue}
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
