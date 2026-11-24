import { Layers } from 'lucide-react';
import { useMemo } from 'react';
import { buildTree } from '../../graph/tree';
import { expandAll, expandToLevel } from '../../graph/visibility';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { Popover } from '../common/Popover';

/** "Níveis": expand all, collapse all, expand to level N (SPEC §6.4). */
export function LevelsMenu() {
  const doc = useApp((s) => s.current?.doc);
  const setExpanded = useApp((s) => s.setExpanded);
  const tree = useMemo(() => (doc ? buildTree(doc) : undefined), [doc]);
  if (!tree) return null;
  const levels = Array.from({ length: tree.maxLevel }, (_, i) => i + 1);

  return (
    <Popover
      label={t.levels.button}
      trigger={
        <>
          <Layers size={16} aria-hidden />
          <span className="max-[1100px]:hidden">{t.levels.button}</span>
        </>
      }
    >
      {(close) => {
        const apply = (ids: Iterable<string>): void => {
          setExpanded(ids);
          close();
        };
        return (
          <ul className="flex flex-col">
            <li>
              <button
                type="button"
                className="w-full rounded px-2 py-1 text-left hover:bg-surface-muted"
                onClick={() => apply(expandAll(tree))}
              >
                {t.levels.expandAll}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full rounded px-2 py-1 text-left hover:bg-surface-muted"
                onClick={() => apply([])}
              >
                {t.levels.collapseAll}
              </button>
            </li>
            {levels.map((level) => (
              <li key={level}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-surface-muted"
                  onClick={() => apply(expandToLevel(tree, level))}
                >
                  {t.levels.expandTo(level)}
                </button>
              </li>
            ))}
          </ul>
        );
      }}
    </Popover>
  );
}
