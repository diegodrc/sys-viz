import { Filter, X } from 'lucide-react';
import { useMemo } from 'react';
import { filterOptions, isFilterActive, NO_HOSTING } from '../../graph/filter';
import { buildTree } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { Popover } from '../common/Popover';

/** Multi-select filters by type and hosting, with active indicator and clear (SPEC §6.4). */
export function FiltersMenu() {
  const doc = useApp((s) => s.current?.doc);
  const filters = useApp((s) => s.filters);
  const toggleType = useApp((s) => s.toggleTypeFilter);
  const togglePlatform = useApp((s) => s.togglePlatformFilter);
  const clearFilters = useApp((s) => s.clearFilters);
  const options = useMemo(() => (doc ? filterOptions(buildTree(doc)) : undefined), [doc]);
  if (!options) return null;
  const activeCount = filters.types.size + filters.platforms.size;
  const active = isFilterActive(filters);

  return (
    <div className="flex items-center gap-1">
      <Popover
        label={t.filters.button}
        triggerClassName={active ? 'border-accent text-accent' : ''}
        trigger={
          <>
            <Filter size={16} aria-hidden />
            <span className="max-[1100px]:hidden">{t.filters.button}</span>
            {active && (
              <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-contrast">
                {activeCount}
              </span>
            )}
          </>
        }
      >
        {() => (
          <div className="flex flex-col gap-3">
            <fieldset>
              <legend className="mb-1 text-xs font-medium uppercase text-text-muted">
                {t.filters.types}
              </legend>
              {options.types.map((type) => (
                <label key={type} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={filters.types.has(type)}
                    onChange={() => toggleType(type)}
                  />
                  {t.nodeTypes[type]}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-xs font-medium uppercase text-text-muted">
                {t.filters.platforms}
              </legend>
              {options.platforms.map((platform) => (
                <label key={platform} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={filters.platforms.has(platform)}
                    onChange={() => togglePlatform(platform)}
                  />
                  {platform === NO_HOSTING ? t.filters.noHosting : t.details.platforms[platform]}
                </label>
              ))}
            </fieldset>
          </div>
        )}
      </Popover>
      {active && (
        <button
          type="button"
          className="icon-button"
          aria-label={t.filters.clear}
          title={t.filters.clearTitle(activeCount)}
          onClick={clearFilters}
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}
