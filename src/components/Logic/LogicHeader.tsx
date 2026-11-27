import { ArrowLeft, Filter, X } from 'lucide-react';
import { useMemo } from 'react';
import { buildTree } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { STEP_CATEGORIES } from '../../schema/system';
import { useApp } from '../../store/context';
import { stepStyle } from '../../theme/stepCategories';
import { Popover } from '../common/Popover';
import { levelLabel } from './labels';

/** Logic view bar: back to the map, request trail and category filter (SPEC §18.7). */
export function LogicHeader() {
  const doc = useApp((s) => s.current?.doc);
  const logic = useApp((s) => s.logic);
  const closeLogic = useApp((s) => s.closeLogic);
  const goToLogicLevel = useApp((s) => s.goToLogicLevel);
  const toggleStepCategory = useApp((s) => s.toggleStepCategory);
  const clearStepCategories = useApp((s) => s.clearStepCategories);
  const tree = useMemo(() => (doc ? buildTree(doc) : undefined), [doc]);
  if (!doc || !tree || !logic) return null;
  const last = logic.trail.length - 1;
  const active = logic.categories.size > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-2 py-1.5">
      <button type="button" className="btn" onClick={closeLogic}>
        <ArrowLeft size={16} aria-hidden />
        {t.logic.backToMap}
      </button>
      <nav aria-label={t.logic.trail} className="min-w-0 flex-1">
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          {logic.trail.map((level, i) => {
            const label = levelLabel(doc, tree, level);
            return (
              <li key={`${i}-${label}`} className="flex items-center gap-1">
                {i > 0 && (
                  <span aria-hidden className="text-text-muted">
                    {t.search.pathSeparator}
                  </span>
                )}
                {i === last ? (
                  <span aria-current="page" className="font-semibold">
                    {label}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rounded px-1 text-accent hover:bg-surface-muted"
                    onClick={() => goToLogicLevel(i)}
                  >
                    {label}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="flex items-center gap-1">
        <Popover
          label={t.logic.filterTitle}
          triggerClassName={active ? 'border-accent text-accent' : ''}
          trigger={
            <>
              <Filter size={16} aria-hidden />
              <span className="max-[900px]:hidden">{t.logic.filter}</span>
              {active && (
                <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-contrast">
                  {logic.categories.size}
                </span>
              )}
            </>
          }
        >
          {() => (
            <fieldset>
              <legend className="mb-1 text-xs font-medium uppercase text-text-muted">
                {t.logic.filter}
              </legend>
              {STEP_CATEGORIES.map((category) => {
                const Icon = stepStyle(category).icon;
                return (
                  <label key={category} className="flex items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={logic.categories.has(category)}
                      onChange={() => toggleStepCategory(category)}
                    />
                    <Icon size={14} aria-hidden style={{ color: stepStyle(category).color }} />
                    {t.logic.categories[category]}
                  </label>
                );
              })}
            </fieldset>
          )}
        </Popover>
        {active && (
          <button
            type="button"
            className="icon-button"
            aria-label={t.logic.clearFilter}
            title={t.logic.clearFilter}
            onClick={clearStepCategories}
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
