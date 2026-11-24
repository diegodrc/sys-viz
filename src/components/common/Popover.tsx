import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface Props {
  /** Accessible name of the trigger button. */
  label: string;
  /** Trigger content (icon + optional text). */
  trigger: ReactNode;
  /** Extra classes for the trigger (e.g. active-filter styling). */
  triggerClassName?: string;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}

/** Button + floating panel; closes on outside click and Esc (SPEC §6.4 "Esc fecha painéis"). */
export function Popover({ label, trigger, triggerClassName, align = 'right', children }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`btn ${triggerClassName ?? ''}`}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-40 mt-1 max-h-[70vh] w-72 overflow-y-auto rounded-md border border-border bg-surface p-3 text-sm shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
