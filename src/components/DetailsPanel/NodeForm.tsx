import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { draftToNode, nodeToDraft, type NodeDraft } from '../../schema/edit';
import { HOSTING_PLATFORMS, NODE_TYPES, type SysNode } from '../../schema/system';
import { useApp } from '../../store/context';
import { FormField } from './FormField';
import { PairsEditor } from './PairsEditor';

interface Props {
  node: SysNode;
  onDone: () => void;
}

/** Node edit form; Save stays disabled while the draft is invalid (SPEC §6.6). */
export function NodeForm({ node, onDone }: Props) {
  const updateNode = useApp((s) => s.updateNode);
  const [draft, setDraft] = useState<NodeDraft>(() => nodeToDraft(node));
  const result = draftToNode(node, draft);
  const errors = result.ok ? {} : result.errors;
  const set = (patch: Partial<NodeDraft>): void => setDraft((d) => ({ ...d, ...patch }));
  const f = t.details.fields;

  return (
    <form
      className="flex flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (result.ok && updateNode(result.value)) onDone();
      }}
    >
      <FormField label={f.name} error={errors.name}>
        <input
          className="field"
          data-autofocus
          value={draft.name}
          required
          onChange={(e) => set({ name: e.target.value })}
        />
      </FormField>
      <FormField label={f.type} error={errors.type}>
        <select
          className="field"
          value={draft.type}
          onChange={(e) => set({ type: e.target.value as NodeDraft['type'] })} // options come from NODE_TYPES
        >
          {NODE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t.nodeTypes[type]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={f.description} error={errors.description}>
        <textarea
          className="field min-h-20"
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </FormField>
      <FormField label={f.technology} error={errors.technology}>
        <input
          className="field"
          value={draft.technology}
          onChange={(e) => set({ technology: e.target.value })}
        />
      </FormField>
      <FormField label={f.platform} error={errors['hosting.platform']}>
        <select
          className="field"
          value={draft.platform}
          onChange={(e) => set({ platform: e.target.value as NodeDraft['platform'] })} // options below
        >
          <option value="">{t.details.platforms.none}</option>
          {HOSTING_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {t.details.platforms[platform]}
            </option>
          ))}
        </select>
      </FormField>
      {draft.platform !== '' && (
        <>
          <FormField label={f.cluster}>
            <input
              className="field"
              value={draft.cluster}
              onChange={(e) => set({ cluster: e.target.value })}
            />
          </FormField>
          <FormField label={f.namespace}>
            <input
              className="field"
              value={draft.namespace}
              onChange={(e) => set({ namespace: e.target.value })}
            />
          </FormField>
          <FormField label={f.hostingDetails}>
            <input
              className="field"
              value={draft.hostingDetails}
              onChange={(e) => set({ hostingDetails: e.target.value })}
            />
          </FormField>
        </>
      )}
      <FormField label={f.owner} error={errors.owner}>
        <input
          className="field"
          value={draft.owner}
          onChange={(e) => set({ owner: e.target.value })}
        />
      </FormField>
      <PairsEditor
        legend={f.links}
        keyLabel={f.linkLabel}
        valueLabel={f.linkUrl}
        addLabel={t.details.addLink}
        prefix="links"
        keyPath="label"
        valuePath="url"
        rows={draft.links}
        errors={errors}
        onChange={(links) => set({ links })}
      />
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
