import { Menu } from 'lucide-react';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { Legend } from '../Legend/Legend';
import { FiltersMenu } from './FiltersMenu';
import { FlowSelector } from './FlowSelector';
import { LevelsMenu } from './LevelsMenu';
import { ResetLayoutButton } from './ResetLayoutButton';
import { SearchBox } from './SearchBox';
import { SystemMenu } from './SystemMenu';
import { ThemeToggle } from './ThemeToggle';

/** Topbar (SPEC §5.1): menu, system, search, flow, filters, levels, legend, reset, theme. */
export function Topbar() {
  const sidebarOpen = useApp((s) => s.prefs.sidebarOpen);
  const setSidebarOpen = useApp((s) => s.setSidebarOpen);

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-2 py-1.5">
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
      <SearchBox />
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
        <FlowSelector />
        <FiltersMenu />
        <LevelsMenu />
        <Legend />
        <ResetLayoutButton />
        <ThemeToggle />
      </div>
    </header>
  );
}
