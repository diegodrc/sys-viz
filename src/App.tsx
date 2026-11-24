import { AppShell } from './components/AppShell';
import type { AppStore } from './store/appStore';
import { AppStoreProvider } from './store/AppStoreProvider';

interface Props {
  /** Injected store for tests; the browser store is used otherwise. */
  store?: AppStore;
}

export function App({ store }: Props) {
  return (
    <AppStoreProvider store={store}>
      <AppShell />
    </AppStoreProvider>
  );
}
