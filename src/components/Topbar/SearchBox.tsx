import { Search } from 'lucide-react';
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchFields, type FieldResult } from '../../graph/logic';
import { searchNodes, type SearchResult } from '../../graph/search';
import { buildTree } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { isTypingTarget } from '../../platform/keyboard';
import { useApp } from '../../store/context';
import { placeLabel } from '../Logic/labels';

type Item = { kind: 'node'; node: SearchResult } | { kind: 'field'; field: FieldResult };

/** Node and field search with `/` shortcut (SPEC §6.4, §18.9: groups Componentes / Campos). */
export function SearchBox() {
  const doc = useApp((s) => s.current?.doc);
  const focusSearchResult = useApp((s) => s.focusSearchResult);
  const openStep = useApp((s) => s.openStep);
  const tree = useMemo(() => (doc ? buildTree(doc) : undefined), [doc]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo((): Item[] => {
    if (!tree || !doc) return [];
    return [
      ...searchNodes(tree, query).map((node): Item => ({ kind: 'node', node })),
      ...searchFields(doc, tree, query).map((field): Item => ({ kind: 'field', field })),
    ];
  }, [doc, tree, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== '/' || isTypingTarget(event.target) || event.ctrlKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!tree) return null;

  const choose = (item: Item): void => {
    if (item.kind === 'node') focusSearchResult(item.node.id);
    else openStep(item.field.graph, item.field.stepId);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const showList = open && query.trim() !== '';

  return (
    <div className="relative min-w-0 max-w-64 flex-1">
      <Search
        size={14}
        aria-hidden
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label={t.search.label}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={t.search.placeholder}
        className="field py-1 pl-7"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (event.key === 'Enter') {
            const result = results[active];
            if (result) choose(result);
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t.search.results}
          className="absolute left-0 top-full z-40 mt-1 max-h-80 w-80 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {results.length === 0 && (
            <li className="px-3 py-1.5 text-sm text-text-muted">{t.search.noResults}</li>
          )}
          {results.map((result, i) => {
            const previous = results[i - 1];
            const header =
              previous?.kind !== result.kind
                ? result.kind === 'node'
                  ? t.search.groupComponents
                  : t.search.groupFields
                : undefined;
            const key =
              result.kind === 'node'
                ? `node-${result.node.id}`
                : `field-${result.field.stepId}-${result.field.field.name}-${i}`;
            return (
              <Fragment key={key}>
                {header && (
                  <li
                    role="presentation"
                    className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
                  >
                    {header}
                  </li>
                )}
                <li
                  role="option"
                  aria-selected={i === active}
                  className={`cursor-pointer px-3 py-1.5 text-sm ${i === active ? 'bg-surface-muted' : ''}`}
                  onMouseDown={(event) => {
                    // mousedown so the choice happens before the input blurs
                    event.preventDefault();
                    choose(result);
                  }}
                >
                  {result.kind === 'node' ? (
                    result.node.path.join(t.search.pathSeparator)
                  ) : (
                    <>
                      <span className="block">
                        {t.search.fieldResult(
                          result.field.field.name,
                          t.logic.roles[result.field.field.role],
                          result.field.stepTitle,
                        )}
                      </span>
                      <span className="block text-xs text-text-muted">
                        {placeLabel(result.field.place)}
                      </span>
                    </>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}
