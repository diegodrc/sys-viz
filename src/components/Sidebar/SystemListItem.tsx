import { CopyPlus, FileBraces, Pencil, Trash } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime, t } from '../../i18n/pt-BR';
import { downloadText } from '../../platform/download';
import { isNarrowScreen } from '../../platform/screen';
import { systemFileName, toExportJson } from '../../storage/backup';
import type { IndexEntry } from '../../storage/localStore';
import { useApp, useAppStoreApi } from '../../store/context';
import { Dialog } from '../common/Dialog';

interface Props {
  entry: IndexEntry;
  active: boolean;
}

export function SystemListItem({ entry, active }: Props) {
  const store = useAppStoreApi();
  const openSystem = useApp((s) => s.openSystem);
  const duplicateSystem = useApp((s) => s.duplicateSystem);
  const deleteSystem = useApp((s) => s.deleteSystem);
  const renameSystem = useApp((s) => s.renameSystem);
  const setSidebarOpen = useApp((s) => s.setSidebarOpen);
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const [name, setName] = useState(entry.name);

  const exportJson = (): void => {
    const doc = store.getState().exportableSystem(entry.id);
    if (doc) downloadText(systemFileName(doc.id), toExportJson(doc));
  };

  const submitRename = (): void => {
    if (renameSystem(entry.id, name)) setDialog(null);
  };

  return (
    <li
      className={`group mb-1 rounded-md border ${active ? 'border-accent bg-surface-muted' : 'border-transparent hover:bg-surface-muted'}`}
    >
      <button
        type="button"
        className="block w-full px-2 pt-2 text-left"
        aria-label={t.systems.open(entry.name)}
        aria-current={active ? 'true' : undefined}
        onClick={() => {
          openSystem(entry.id);
          if (isNarrowScreen()) setSidebarOpen(false);
        }}
      >
        <span className="block truncate text-sm font-medium">{entry.name}</span>
        <span className="block text-xs text-text-muted">
          {t.systems.summary(entry.nodeCount, formatDateTime(entry.updatedAt))}
        </span>
      </button>
      <div
        role="group"
        aria-label={t.systems.actionsFor(entry.name)}
        className="flex justify-end gap-0.5 px-1 pb-1"
      >
        <button
          type="button"
          className="icon-button size-7"
          aria-label={t.systems.rename}
          title={t.systems.rename}
          onClick={() => {
            setName(entry.name);
            setDialog('rename');
          }}
        >
          <Pencil size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-button size-7"
          aria-label={t.systems.duplicate}
          title={t.systems.duplicate}
          onClick={() => duplicateSystem(entry.id)}
        >
          <CopyPlus size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-button size-7"
          aria-label={t.systems.exportJson}
          title={t.systems.exportJson}
          onClick={exportJson}
        >
          <FileBraces size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-button size-7 hover:text-danger"
          aria-label={t.systems.remove}
          title={t.systems.remove}
          onClick={() => setDialog('delete')}
        >
          <Trash size={14} aria-hidden />
        </button>
      </div>

      {dialog === 'rename' && (
        <Dialog
          title={t.systems.renameTitle}
          onClose={() => setDialog(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setDialog(null)}>
                {t.common.cancel}
              </button>
              <button
                type="submit"
                form={`rename-${entry.id}`}
                className="btn btn-primary"
                disabled={!name.trim()}
              >
                {t.common.save}
              </button>
            </>
          }
        >
          <form
            id={`rename-${entry.id}`}
            onSubmit={(event) => {
              event.preventDefault();
              submitRename();
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              {t.systems.nameLabel}
              <input
                data-autofocus
                className="field"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={!name.trim()}
              />
            </label>
            {!name.trim() && <p className="mt-1 text-xs text-danger">{t.systems.nameRequired}</p>}
          </form>
        </Dialog>
      )}

      {dialog === 'delete' && (
        <Dialog
          title={t.systems.removeTitle}
          onClose={() => setDialog(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setDialog(null)} data-autofocus>
                {t.common.cancel}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setDialog(null);
                  deleteSystem(entry.id);
                }}
              >
                {t.systems.remove}
              </button>
            </>
          }
        >
          <p className="text-sm">{t.systems.removeConfirm(entry.name)}</p>
        </Dialog>
      )}
    </li>
  );
}
