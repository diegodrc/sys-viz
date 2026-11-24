import { useId, type ReactElement } from 'react';
import { cloneElement } from 'react';

interface Props {
  label: string;
  error?: string | undefined;
  /** A single input/select/textarea; it receives id, aria-invalid and aria-describedby. */
  children: ReactElement<Record<string, unknown>>;
}

/** Labelled form control with its field error (SPEC §6.6 "erros aparecem por campo"). */
export function FormField({ label, error, children }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1 py-1">
      <label htmlFor={id} className="text-xs font-medium text-text-muted">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
