import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { Dialog } from '../common/Dialog';

/** "Resetar layout" with confirmation (SPEC §5.5). */
export function ResetLayoutButton() {
  const hasSystem = useApp((s) => s.current !== undefined);
  const resetLayout = useApp((s) => s.resetLayout);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={!hasSystem}
        onClick={() => setConfirming(true)}
        aria-label={t.layout.reset}
        title={t.layout.reset}
      >
        <RotateCcw size={16} aria-hidden />
        <span className="max-[700px]:hidden">{t.layout.reset}</span>
      </button>
      {confirming && (
        <Dialog
          title={t.layout.resetTitle}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button
                type="button"
                className="btn"
                data-autofocus
                onClick={() => setConfirming(false)}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setConfirming(false);
                  resetLayout();
                }}
              >
                {t.common.confirm}
              </button>
            </>
          }
        >
          <p className="text-sm">{t.layout.resetConfirm}</p>
        </Dialog>
      )}
    </>
  );
}
