import { Copy, Upload } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { copyText } from '../../platform/clipboard';
import { buildCreatePrompt } from '../../prompts/createPrompt';
import { buildEvolvePrompt } from '../../prompts/evolvePrompt';
import { buildReposPrompt } from '../../prompts/reposPrompt';
import { useApp } from '../../store/context';
import { Dialog } from '../common/Dialog';

type Tab = 'create' | 'repos' | 'evolve';

const TABS: readonly Tab[] = ['create', 'repos', 'evolve'];

const TAB_LABELS: Readonly<Record<Tab, string>> = {
  create: t.ai.tabCreate,
  repos: t.ai.tabRepos,
  evolve: t.ai.tabEvolve,
};

/** "Gerar com IA": create/repos/evolve prompts with copy and a shortcut to import (SPEC §9.1). */
export function AiPromptDialog() {
  const open = useApp((s) => s.dialog === 'ai');
  const doc = useApp((s) => s.current?.doc);
  const closeDialog = useApp((s) => s.closeDialog);
  const openImport = useApp((s) => s.openImport);
  const [tab, setTab] = useState<Tab>('create');
  const [status, setStatus] = useState<string | null>(null);
  const textId = useId();

  const activeTab: Tab = tab === 'evolve' && !doc ? 'create' : tab;
  const prompt = useMemo(() => {
    if (!open) return '';
    if (activeTab === 'evolve' && doc) return buildEvolvePrompt(doc);
    if (activeTab === 'repos') return buildReposPrompt();
    return buildCreatePrompt();
  }, [open, activeTab, doc]);

  if (!open) return null;

  const choose = (next: Tab): void => {
    setTab(next);
    setStatus(null);
  };

  return (
    <Dialog
      title={t.ai.title}
      wide
      onClose={() => {
        setStatus(null);
        closeDialog();
      }}
      footer={
        <>
          <button type="button" className="btn" onClick={openImport}>
            <Upload size={16} aria-hidden />
            {t.ai.importJson}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void copyText(prompt).then((ok) => setStatus(ok ? t.ai.copied : t.ai.copyFailed));
            }}
          >
            <Copy size={16} aria-hidden />
            {t.ai.copy}
          </button>
        </>
      }
    >
      <div
        role="tablist"
        aria-label={t.ai.title}
        className="mb-3 flex gap-1 border-b border-border"
      >
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={textId}
            disabled={id === 'evolve' && !doc}
            title={id === 'evolve' && !doc ? t.ai.evolveDisabled : undefined}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm disabled:opacity-50 ${activeTab === id ? 'border-accent font-semibold text-accent' : 'border-transparent text-text-muted'}`}
            onClick={() => choose(id)}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </div>
      <label htmlFor={textId} className="text-xs font-medium text-text-muted">
        {t.ai.promptLabel}
      </label>
      <textarea
        id={textId}
        role="tabpanel"
        readOnly
        className="field mt-1 h-72 font-mono text-xs"
        value={prompt}
        onFocus={(event) => event.target.select()}
      />
      <p className="mt-2 text-sm text-text-muted">
        {activeTab === 'repos' ? t.ai.instructionsRepos : t.ai.instructions}
      </p>
      {status && (
        <p role="status" className="mt-1 text-sm">
          {status}
        </p>
      )}
    </Dialog>
  );
}
