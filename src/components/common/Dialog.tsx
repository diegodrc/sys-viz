import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { t } from '../../i18n/pt-BR';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons rendered in the footer. */
  footer?: ReactNode;
  wide?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal dialog with focus trap, Esc to close and focus restore (SPEC §11.5). */
export function Dialog({ title, onClose, children, footer, wide }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    if (!firstItem || !lastItem) return;
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`flex max-h-[90vh] w-full flex-col rounded-lg border border-border bg-surface text-text shadow-xl outline-none ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label={t.common.close}
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="overflow-y-auto px-4 py-3">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
