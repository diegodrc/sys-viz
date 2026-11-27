import { X } from 'lucide-react';
import { useMemo } from 'react';
import { buildTree } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { graphOf } from '../../schema/logic';
import { levelRef } from '../../store/appStore';
import { useApp } from '../../store/context';
import { GraphDetails } from './GraphDetails';
import { StepDetails } from './StepDetails';

/** Details panel of the logic view (SPEC §18.7); closed when nothing is selected. */
export function LogicDetailsPanel() {
  const doc = useApp((s) => s.current?.doc);
  const logic = useApp((s) => s.logic);
  const selectLogic = useApp((s) => s.selectLogic);
  const tree = useMemo(() => (doc ? buildTree(doc) : undefined), [doc]);
  const level = logic?.trail.at(-1);
  const selection = logic?.selection;
  if (!doc || !tree || !level || !selection) return null;
  const ref = levelRef(level);
  const graph = graphOf(doc, ref);
  if (!graph) return null;

  let title: string;
  let body: React.ReactNode = null;
  if (selection.kind === 'step') {
    const step = graph.steps.find((s) => s.id === selection.id);
    title = t.logic.kinds.step;
    body = step ? <StepDetails key={step.id} doc={doc} graph={ref} step={step} /> : null;
  } else {
    title = ref.kind === 'handler' ? t.logic.kinds.handler : t.logic.kinds.subprocess;
    body = <GraphDetails key={JSON.stringify(ref)} doc={doc} tree={tree} graph={ref} />;
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
          onClick={() => selectLogic(undefined)}
        >
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{body}</div>
    </aside>
  );
}
