import { BookOpen } from 'lucide-react';
import { useMemo } from 'react';
import { filterOptions } from '../../graph/filter';
import { buildTree } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { NODE_TYPE_STYLES } from '../../theme/nodeTypes';
import { Popover } from '../common/Popover';

function EdgeSample({
  dashed,
  faded,
  label,
}: {
  dashed?: boolean;
  faded?: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2 py-0.5">
      <svg width="48" height="10" aria-hidden className="shrink-0">
        <line
          x1="2"
          y1="5"
          x2="46"
          y2="5"
          stroke="var(--color-text-muted)"
          strokeWidth="2"
          strokeDasharray={dashed ? '6 4' : undefined}
          opacity={faded ? 0.5 : 1}
        />
      </svg>
      {label}
    </li>
  );
}

/** Icon/color per node type present in the system and edge styles (SPEC §6.4). */
export function Legend() {
  const doc = useApp((s) => s.current?.doc);
  const types = useMemo(() => (doc ? filterOptions(buildTree(doc)).types : []), [doc]);
  if (!doc) return null;

  return (
    <Popover
      label={t.legend.button}
      trigger={
        <>
          <BookOpen size={16} aria-hidden />
          <span className="max-[1100px]:hidden">{t.legend.button}</span>
        </>
      }
    >
      {() => (
        <div className="flex flex-col gap-3">
          <section>
            <h3 className="mb-1 text-xs font-medium uppercase text-text-muted">
              {t.legend.nodeTypes}
            </h3>
            <ul>
              {types.map((type) => {
                const style = NODE_TYPE_STYLES[type];
                const Icon = style.icon;
                return (
                  <li key={type} className="flex items-center gap-2 py-0.5">
                    <Icon size={16} aria-hidden style={{ color: style.color }} />
                    {t.nodeTypes[type]}
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <h3 className="mb-1 text-xs font-medium uppercase text-text-muted">{t.legend.edges}</h3>
            <ul>
              <EdgeSample label={t.legend.sync} />
              <EdgeSample label={t.legend.async} dashed />
              <EdgeSample label={t.legend.assumed} faded />
              <EdgeSample label={t.legend.aggregated} />
            </ul>
          </section>
        </div>
      )}
    </Popover>
  );
}
