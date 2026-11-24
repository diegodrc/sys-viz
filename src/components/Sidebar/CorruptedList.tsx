import { TriangleExclamationPoint } from 'lucide-react';
import { t } from '../../i18n/pt-BR';
import { downloadText } from '../../platform/download';
import { useApp, useAppStoreApi } from '../../store/context';

/** Stored systems that failed to load (SPEC §7): download raw content or remove. */
export function CorruptedList() {
  const store = useAppStoreApi();
  const corrupted = useApp((s) => s.corrupted);
  const removeCorrupted = useApp((s) => s.removeCorrupted);
  if (corrupted.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2 border-b border-border p-3">
      {corrupted.map(({ id }) => (
        <li key={id} role="alert" className="rounded-md border border-danger p-2 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-danger">
            <TriangleExclamationPoint size={14} aria-hidden />
            {t.storage.corrupted(id)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn"
              onClick={() =>
                downloadText(`${id}.json`, store.getState().rawSystemText(id) ?? '', 'text/plain')
              }
            >
              {t.storage.downloadRaw}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => removeCorrupted(id)}>
              {t.storage.removeCorrupted}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
