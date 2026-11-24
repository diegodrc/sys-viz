import { Menu } from 'lucide-react';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { FlowSelector } from './FlowSelector';
import { ResetLayoutButton } from './ResetLayoutButton';
import { SystemMenu } from './SystemMenu';

export function Topbar() {
  const sidebarOpen = useApp((s) => s.prefs.sidebarOpen);
  const setSidebarOpen = useApp((s) => s.setSidebarOpen);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-2">
      <button
        type="button"
        className="icon-button"
        aria-label={t.topbar.toggleSidebar}
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu size={18} aria-hidden />
      </button>
      <SystemMenu />
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <FlowSelector />
        <ResetLayoutButton />
      </div>
    </header>
  );
}
