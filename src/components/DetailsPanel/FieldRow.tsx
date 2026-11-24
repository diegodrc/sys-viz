import type { ReactNode } from 'react';
import { t } from '../../i18n/pt-BR';

interface Props {
  label: string;
  children?: ReactNode;
}

/** Read-only label/value pair; empty values show a dash. */
export function FieldRow({ label, children }: Props) {
  const empty = children === undefined || children === null || children === '';
  return (
    <div className="py-1.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap">
        {empty ? <span className="text-text-muted">{t.details.empty}</span> : children}
      </dd>
    </div>
  );
}
