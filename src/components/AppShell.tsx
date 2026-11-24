import { useEffect } from 'react';
import { useApp, useAppStoreApi } from '../store/context';
import { Canvas } from './Canvas/Canvas';
import { NoticeBar } from './common/NoticeBar';
import { ErrorBoundary } from './ErrorBoundary';
import { ImportDialog } from './ImportDialog/ImportDialog';
import { Sidebar } from './Sidebar/Sidebar';
import { Topbar } from './Topbar/Topbar';

/** Screen layout (SPEC §5.1): topbar, collapsible sidebar, canvas. */
export function AppShell() {
  const store = useAppStoreApi();
  const sidebarOpen = useApp((s) => s.prefs.sidebarOpen);
  const currentId = useApp((s) => s.current?.doc.id);
  const closeSystem = useApp((s) => s.closeSystem);

  useEffect(() => {
    // `ready` is set synchronously by init, so the StrictMode double effect runs it once
    if (!store.getState().ready) store.getState().init();
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
      </div>
      <ImportDialog />
    </div>
  );
}
