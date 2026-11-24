import { Info, Route } from 'lucide-react';
import { useId } from 'react';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';

/** Flow selector with "Expandir caminho" and flow details (SPEC §6.5, §6.6). */
export function FlowSelector() {
  const id = useId();
  const flows = useApp((s) => s.current?.doc.flows);
  const activeId = useApp((s) => s.activeFlow?.id);
  const selectFlow = useApp((s) => s.selectFlow);
  const expandFlowPath = useApp((s) => s.expandFlowPath);
  const select = useApp((s) => s.select);
  if (!flows || flows.length === 0) return null;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <label htmlFor={id} className="text-sm text-text-muted max-[700px]:sr-only">
        {t.flows.selector}
      </label>
      <select
        id={id}
        className="field w-auto max-w-[14rem] py-1"
        value={activeId ?? ''}
        onChange={(event) => selectFlow(event.target.value || undefined)}
      >
        <option value="">{t.flows.none}</option>
        {flows.map((flow) => (
          <option key={flow.id} value={flow.id}>
            {flow.name}
          </option>
        ))}
      </select>
      {activeId && (
        <>
          <button
            type="button"
            className="btn"
            onClick={expandFlowPath}
            aria-label={t.flows.expandPath}
            title={t.flows.expandPath}
          >
            <Route size={16} aria-hidden />
            <span className="max-[900px]:hidden">{t.flows.expandPath}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t.flows.details}
            title={t.flows.details}
            onClick={() => select({ kind: 'flow', id: activeId })}
          >
            <Info size={16} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
