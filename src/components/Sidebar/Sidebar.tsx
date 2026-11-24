import { CircleQuestionMark, Download, Sparkles, Upload } from 'lucide-react';
import { t } from '../../i18n/pt-BR';
import { downloadText } from '../../platform/download';
import { backupFileName, buildBackup, toExportJson } from '../../storage/backup';
import { useApp, useAppStoreApi } from '../../store/context';
import { CorruptedList } from './CorruptedList';
import { SystemListItem } from './SystemListItem';

/** Saved systems with global actions: import, backup, "Gerar com IA" (SPEC §6.1). */
export function Sidebar() {
  const store = useAppStoreApi();
  const systems = useApp((s) => s.systems);
  const currentId = useApp((s) => s.current?.doc.id);
  const openImport = useApp((s) => s.openImport);
  const openDialog = useApp((s) => s.openDialog);
  const loadExample = useApp((s) => s.loadExample);

  const exportBackup = (): void => {
    const now = new Date();
    const backup = buildBackup(store.getState().exportableSystems(), now);
    downloadText(backupFileName(now), toExportJson(backup));
  };

  const aiButton = (
    <button type="button" className="btn" onClick={() => openDialog('ai')}>
      <Sparkles size={16} aria-hidden />
      {t.ai.button}
    </button>
  );

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
          {aiButton}
        </div>
      </div>
      <CorruptedList />
      {systems.length === 0 ? (
        <div className="flex flex-1 flex-col items-start gap-2 p-3 text-sm">
          <p className="text-text-muted">{t.systems.empty}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={loadExample}>
              {t.systems.loadExample}
            </button>
            {aiButton}
          </div>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto p-2">
          {systems.map((entry) => (
            <SystemListItem key={entry.id} entry={entry} active={entry.id === currentId} />
          ))}
        </ul>
      )}
      <div className="border-t border-border p-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-text-muted hover:bg-surface-muted hover:text-text"
          onClick={() => openDialog('about')}
        >
          <CircleQuestionMark size={16} aria-hidden />
          {t.about.button}
        </button>
      </div>
    </aside>
  );
}
