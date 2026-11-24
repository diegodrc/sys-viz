import { useEffect } from 'react';
import { isTypingTarget } from '../platform/keyboard';
import { useApp, useAppStoreApi } from '../store/context';
import { useResolvedTheme } from '../theme/useResolvedTheme';
import { AboutDialog } from './AboutDialog/AboutDialog';
import { AiPromptDialog } from './AiPromptDialog/AiPromptDialog';
import { Canvas } from './Canvas/Canvas';
import { NoticeBar } from './common/NoticeBar';
import { DetailsPanel } from './DetailsPanel/DetailsPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { ImportDialog } from './ImportDialog/ImportDialog';
import { Sidebar } from './Sidebar/Sidebar';
import { Topbar } from './Topbar/Topbar';

/** Screen layout (SPEC §5.1): topbar, collapsible sidebar, canvas, details panel. */
export function AppShell() {
  const store = useAppStoreApi();
  const sidebarOpen = useApp((s) => s.prefs.sidebarOpen);
  const theme = useApp((s) => s.prefs.theme);
  const currentId = useApp((s) => s.current?.doc.id);
  const closeSystem = useApp((s) => s.closeSystem);
  useResolvedTheme(theme);

  useEffect(() => {
    // `ready` is set synchronously by init, so the StrictMode double effect runs it once
    if (!store.getState().ready) store.getState().init();
  }, [store]);

  // SPEC §6.4: Esc always works — in a field it first removes focus; otherwise it clears the
  // selection (closing the details panel). Dialogs and popovers close themselves on Esc.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (isTypingTarget(event.target) && event.target instanceof HTMLElement) {
        event.target.blur();
        return;
      }
      store.getState().select(undefined);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <Topbar />
      <NoticeBar />
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && <Sidebar />}
        <main className="relative min-w-0 flex-1">
          <ErrorBoundary resetKey={currentId} onReset={closeSystem}>
            <Canvas />
          </ErrorBoundary>
        </main>
        <DetailsPanel />
      </div>
      <ImportDialog />
      <AiPromptDialog />
      <AboutDialog />
    </div>
  );
}
