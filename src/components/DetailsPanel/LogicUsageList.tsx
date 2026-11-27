import { graphPlace, type StepRef } from '../../graph/logic';
import type { TreeIndex } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { graphOf } from '../../schema/logic';
import type { SystemDoc } from '../../schema/system';
import { useApp } from '../../store/context';
import { placeLabel } from '../Logic/labels';

interface Props {
  doc: SystemDoc;
  tree: TreeIndex;
  usages: readonly StepRef[];
  empty: string;
}

/** "Usada em" / "Usado em": logic steps that reference an edge or subprocess (SPEC §18.6–18.7). */
export function LogicUsageList({ doc, tree, usages, empty }: Props) {
  const openStep = useApp((s) => s.openStep);
  if (usages.length === 0) return <p className="text-sm text-text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col gap-0.5">
      {usages.map((usage) => {
        const step = graphOf(doc, usage.graph)?.steps.find((s) => s.id === usage.stepId);
        const label = t.logic.usageItem(
          placeLabel(graphPlace(doc, tree, usage.graph)),
          step?.title ?? usage.stepId,
        );
        return (
          <li key={`${JSON.stringify(usage.graph)}-${usage.stepId}`}>
            <button
              type="button"
              className="w-full rounded px-1 py-0.5 text-left text-sm text-accent hover:bg-surface-muted"
              onClick={() => openStep(usage.graph, usage.stepId)}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
