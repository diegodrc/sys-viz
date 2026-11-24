import { Copy } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { copyText } from '../../platform/clipboard';

/** Read-only id with a copy button (SPEC §6.6). */
export function IdRow({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="py-1.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {t.details.fields.id}
      </dt>
      <dd className="mt-0.5 flex items-center gap-1">
        <code className="min-w-0 flex-1 truncate font-mono text-sm">{id}</code>
        <button
          type="button"
          className="icon-button size-7"
          aria-label={t.details.copyId}
          title={t.details.copyId}
          onClick={() => {
            void copyText(id).then(setCopied);
          }}
        >
          <Copy size={14} aria-hidden />
        </button>
        {copied && (
          <span role="status" className="text-xs text-text-muted">
            {t.details.idCopied}
          </span>
        )}
      </dd>
    </div>
  );
}
