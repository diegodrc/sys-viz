import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchNodes } from '../../graph/search';
import { buildTree } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { isTypingTarget } from '../../platform/keyboard';
import { useApp } from '../../store/context';

/** Node search with `/` shortcut and hierarchical results (SPEC §6.4). */
export function SearchBox() {
  const doc = useApp((s) => s.current?.doc);
  const focusSearchResult = useApp((s) => s.focusSearchResult);
  const tree = useMemo(() => (doc ? buildTree(doc) : undefined), [doc]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => (tree ? searchNodes(tree, query) : []), [tree, query]);

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

  const choose = (id: string): void => {
    focusSearchResult(id);
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
            if (result) choose(result.id);
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
          {results.map((result, i) => (
            <li
              key={result.id}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-1.5 text-sm ${i === active ? 'bg-surface-muted' : ''}`}
              onMouseDown={(event) => {
                // mousedown so the choice happens before the input blurs
                event.preventDefault();
                choose(result.id);
              }}
            >
              {result.path.join(t.search.pathSeparator)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
