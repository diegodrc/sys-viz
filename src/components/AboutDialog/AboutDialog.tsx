import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { Dialog } from '../common/Dialog';

/** "Sobre/Ajuda" with the file:// storage note (SPEC §2.1) and keyboard shortcuts. */
export function AboutDialog() {
  const open = useApp((s) => s.dialog === 'about');
  const closeDialog = useApp((s) => s.closeDialog);
  if (!open) return null;

  return (
    <Dialog title={t.about.title} onClose={closeDialog}>
      <div className="flex flex-col gap-3 text-sm">
        <p>{t.about.intro}</p>
        <p className="rounded-md border border-warning p-2">{t.about.fileNote}</p>
        <section>
          <h3 className="mb-1 font-medium">{t.about.shortcutsTitle}</h3>
          <ul className="list-disc pl-5">
            {t.about.shortcuts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}
