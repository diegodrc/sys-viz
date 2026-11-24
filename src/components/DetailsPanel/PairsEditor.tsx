import { Plus, X } from 'lucide-react';
import { t } from '../../i18n/pt-BR';
import type { FieldErrors, PairDraft } from '../../schema/edit';

interface Props {
  legend: string;
  keyLabel: string;
  valueLabel: string;
  addLabel: string;
  /** Error key prefix, e.g. `links` -> `links.0.url`; `metadata` -> `metadata.0.key`. */
  prefix: string;
  /** Names of the key/value parts in error paths (`label`/`url` for links, `key`/`value`). */
  keyPath: string;
  valuePath: string;
  rows: PairDraft[];
  errors: FieldErrors;
  onChange: (rows: PairDraft[]) => void;
}

/** Editable list of key/value rows with add/remove (links and metadata, SPEC §6.6). */
export function PairsEditor({
  legend,
  keyLabel,
  valueLabel,
  addLabel,
  prefix,
  keyPath,
  valuePath,
  rows,
  errors,
  onChange,
}: Props) {
  const update = (index: number, patch: Partial<PairDraft>): void => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <fieldset className="py-1">
      <legend className="text-xs font-medium text-text-muted">{legend}</legend>
      {rows.length === 0 && <p className="text-sm text-text-muted">{t.details.noItems}</p>}
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, i) => {
          const keyError = errors[`${prefix}.${i}.${keyPath}`];
          const valueError = errors[`${prefix}.${i}.${valuePath}`];
          return (
            <li key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <input
                  className="field min-w-0 flex-1"
                  aria-label={`${keyLabel} ${i + 1}`}
                  aria-invalid={keyError ? true : undefined}
                  value={row.key}
                  onChange={(event) => update(i, { key: event.target.value })}
                />
                <input
                  className="field min-w-0 flex-[2]"
                  aria-label={`${valueLabel} ${i + 1}`}
                  aria-invalid={valueError ? true : undefined}
                  value={row.value}
                  onChange={(event) => update(i, { value: event.target.value })}
                />
                <button
                  type="button"
                  className="icon-button size-7"
                  aria-label={`${t.details.removeRow} ${i + 1}`}
                  onClick={() => onChange(rows.filter((_, j) => j !== i))}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
              {keyError && <p className="text-xs text-danger">{keyError}</p>}
              {valueError && <p className="text-xs text-danger">{valueError}</p>}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="btn mt-1.5"
        onClick={() => onChange([...rows, { key: '', value: '' }])}
      >
        <Plus size={14} aria-hidden />
        {addLabel}
      </button>
    </fieldset>
  );
}
