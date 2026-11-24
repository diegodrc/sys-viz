import { Download, Upload } from 'lucide-react';
import { t } from '../../i18n/pt-BR';
import { downloadText } from '../../platform/download';
import { backupFileName, buildBackup, toExportJson } from '../../storage/backup';
import { useApp, useAppStoreApi } from '../../store/context';
import { CorruptedList } from './CorruptedList';
import { SystemListItem } from './SystemListItem';

export function Sidebar() {
  const store = useAppStoreApi();
  const systems = useApp((s) => s.systems);
  const currentId = useApp((s) => s.current?.doc.id);
  const openImport = useApp((s) => s.openImport);
  const loadExample = useApp((s) => s.loadExample);

  const exportBackup = (): void => {
    const now = new Date();
    const backup = buildBackup(store.getState().exportableSystems(), now);
    downloadText(backupFileName(now), toExportJson(backup));
  };

  return (
    <aside
      aria-label={t.systems.title}
      className="flex w-72 shrink-0 flex-col border-r border-border bg-surface max-[900px]:absolute max-[900px]:inset-y-0 max-[900px]:left-0 max-[900px]:z-30 max-[900px]:shadow-xl"
    >
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          {t.systems.title}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={openImport}>
            <Upload size={16} aria-hidden />
            {t.systems.importButton}
          </button>
          <button
            type="button"
            className="btn"
            onClick={exportBackup}
            disabled={systems.length === 0}
          >
            <Download size={16} aria-hidden />
            {t.systems.exportBackup}
          </button>
        </div>
      </div>
      <CorruptedList />
      {systems.length === 0 ? (
        <div className="flex flex-col items-start gap-2 p-3 text-sm">
          <p className="text-text-muted">{t.systems.empty}</p>
          <button type="button" className="btn" onClick={loadExample}>
            {t.systems.loadExample}
          </button>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2">
          {systems.map((entry) => (
            <SystemListItem key={entry.id} entry={entry} active={entry.id === currentId} />
          ))}
        </ul>
      )}
    </aside>
  );
}
