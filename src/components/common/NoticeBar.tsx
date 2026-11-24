import { Info, TriangleExclamationPoint, X } from 'lucide-react';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';

/** Transient messages: storage errors, import warnings, confirmations. */
export function NoticeBar() {
  const notice = useApp((s) => s.notice);
  const dismiss = useApp((s) => s.dismissNotice);
  if (!notice) return null;

  const isError = notice.kind === 'error';
  const Icon = notice.kind === 'info' ? Info : TriangleExclamationPoint;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-2 border-b px-4 py-2 text-sm ${isError ? 'border-danger text-danger' : 'border-border text-text'} bg-surface`}
    >
      <Icon size={16} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {notice.kind === 'warnings' ? (
          <details>
            <summary className="cursor-pointer">{notice.message}</summary>
            <ul className="mt-1 list-disc pl-5 text-text-muted">
              {notice.details.map((issue, i) => (
                <li key={`${issue.path}-${i}`}>{issue.message}</li>
              ))}
            </ul>
          </details>
        ) : (
          <p>{notice.message}</p>
        )}
      </div>
      <button
        type="button"
        className="icon-button size-6"
        aria-label={t.common.dismiss}
        onClick={dismiss}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
