import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { errorsForAi } from '../../import/importSystem';
import { copyText } from '../../platform/clipboard';
import type { Issue } from '../../schema/result';
import { useApp } from '../../store/context';
import { Dialog } from '../common/Dialog';

function IssueList({ issues }: { issues: readonly Issue[] }) {
  return (
    <ul className="mt-2 max-h-64 list-disc overflow-y-auto pl-5 text-sm">
      {issues.map((issue, i) => (
        <li key={`${issue.path}-${i}`}>
          {issue.path && (
            <code className="mr-1 font-mono text-xs text-text-muted">{issue.path}</code>
          )}
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

/** Import from file or pasted text, with errors and id-conflict decisions (SPEC §6.2). */
export function ImportDialog() {
  const importer = useApp((s) => s.importer);
  const closeImport = useApp((s) => s.closeImport);
  const openImport = useApp((s) => s.openImport);
  const importText = useApp((s) => s.importText);
  const resolveConflict = useApp((s) => s.resolveConflict);
  const importValid = useApp((s) => s.importValidBackupSystems);
  const resolveBackupConflict = useApp((s) => s.resolveBackupConflict);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  if (!importer) return null;

  const close = (): void => {
    setStatus(null);
    setText('');
    closeImport();
  };

  const cancelButton = (
    <button type="button" className="btn" onClick={close}>
      {t.common.cancel}
    </button>
  );

  if (importer.step === 'input') {
    return (
      <Dialog
        title={t.importer.title}
        onClose={close}
        wide
        footer={
          <>
            {cancelButton}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!text.trim()}
              onClick={() => importText(text)}
            >
              {t.importer.submit}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            {t.importer.fileLabel}
            <input
              type="file"
              accept=".json,application/json,text/plain"
              className="text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                file.text().then(importText, () => setStatus(t.importer.readFailed));
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            {t.importer.pasteLabel}
            <textarea
              data-autofocus
              className="field h-56 font-mono text-xs"
              spellCheck={false}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          {status && (
            <p role="status" className="text-danger">
              {status}
            </p>
          )}
        </div>
      </Dialog>
    );
  }

  if (importer.step === 'errors') {
    const copyErrors = async (): Promise<void> => {
      const ok = await copyText(errorsForAi(importer.errors));
      setStatus(ok ? t.importer.copied : t.importer.copyFailed);
    };
    return (
      <Dialog
        title={t.importer.errorsTitle(importer.errors.length)}
        onClose={close}
        wide
        footer={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setStatus(null);
                openImport();
              }}
            >
              {t.importer.back}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void copyErrors()}>
              {t.importer.copyErrors}
            </button>
          </>
        }
      >
        <p className="text-sm font-medium text-danger">{t.importer.nothingImported}</p>
        <IssueList issues={importer.errors} />
        {status && (
          <p role="status" className="mt-2 text-sm">
            {status}
          </p>
        )}
      </Dialog>
    );
  }

  if (importer.step === 'conflict') {
    return (
      <Dialog
        title={t.importer.conflictTitle}
        onClose={close}
        footer={
          <>
            {cancelButton}
            <button type="button" className="btn" onClick={() => resolveConflict('copy')}>
              {t.importer.importAsCopy}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => resolveConflict('replace')}
            >
              {t.importer.replace}
            </button>
          </>
        }
      >
        <p className="text-sm">
          {t.importer.conflictMessage(importer.doc.id, importer.existingName)}
        </p>
      </Dialog>
    );
  }

  if (importer.step === 'backupInvalid') {
    return (
      <Dialog
        title={t.importer.backupInvalidTitle(importer.invalid.length)}
        onClose={close}
        wide
        footer={
          <>
            {cancelButton}
            {importer.valid.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={importValid}>
                {t.importer.importValidOnly(importer.valid.length)}
              </button>
            )}
          </>
        }
      >
        {importer.valid.length === 0 && (
          <p className="text-sm text-danger">{t.importer.backupNoneValid}</p>
        )}
        <ul className="flex flex-col gap-3">
          {importer.invalid.map((entry) => (
            <li key={entry.index} className="text-sm">
              <p className="font-medium">
                {t.importer.backupInvalidItem(entry.index + 1, entry.id)}
              </p>
              <IssueList issues={entry.errors} />
            </li>
          ))}
        </ul>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={t.importer.backupConflictTitle}
      onClose={close}
      footer={
        <>
          {cancelButton}
          <button type="button" className="btn" onClick={() => resolveBackupConflict('copy')}>
            {t.importer.importAsCopies}
          </button>
          <button type="button" className="btn" onClick={() => resolveBackupConflict('skip')}>
            {t.importer.skipExisting}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => resolveBackupConflict('replace')}
          >
            {t.importer.replaceAll}
          </button>
        </>
      }
    >
      <p className="text-sm">{t.importer.backupConflictMessage(importer.conflictIds)}</p>
    </Dialog>
  );
}
