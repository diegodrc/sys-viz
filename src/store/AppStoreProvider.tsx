import { useState, type ReactNode } from 'react';
import type { AppStore } from './appStore';
import { AppStoreContext, createBrowserAppStore } from './context';

interface Props {
  /** Injected store (tests); defaults to one backed by the browser's localStorage. */
  store?: AppStore;
  children: ReactNode;
}

export function AppStoreProvider({ store, children }: Props) {
  const [value] = useState<AppStore>(() => store ?? createBrowserAppStore());
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}
