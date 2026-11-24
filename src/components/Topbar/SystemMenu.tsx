import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';

/** "Nome do sistema ▾": quick switch between saved systems (SPEC §6.1). */
export function SystemMenu() {
  const name = useApp((s) => s.current?.doc.name);
  const currentId = useApp((s) => s.current?.doc.id);
  const systems = useApp((s) => s.systems);
  const openSystem = useApp((s) => s.openSystem);
  const select = useApp((s) => s.select);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        className="flex max-w-[50vw] items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold hover:bg-surface-muted"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.topbar.systemMenu}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <span className="truncate">{name ?? t.topbar.noSystem}</span>
        <ChevronDown size={16} aria-hidden className="shrink-0" />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute left-0 top-full z-40 mt-1 max-h-80 w-72 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          {systems.map((entry) => (
            <li key={entry.id} role="none">
              <button
                type="button"
                role="menuitem"
                className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-surface-muted ${entry.id === currentId ? 'font-semibold text-accent' : ''}`}
                onClick={() => {
                  setOpen(false);
                  openSystem(entry.id);
                }}
              >
                {entry.name}
              </button>
            </li>
          ))}
          {currentId && (
            <li role="none" className="mt-1 border-t border-border pt-1">
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-muted"
                onClick={() => {
                  setOpen(false);
                  select({ kind: 'system' });
                }}
              >
                {t.topbar.systemDetails}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
