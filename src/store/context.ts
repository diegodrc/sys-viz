import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { browserStorage, memoryStorage } from '../storage/localStore';
import { createAppStore, type AppState, type AppStore } from './appStore';

export const AppStoreContext = createContext<AppStore | null>(null);

/** Store backed by the browser's localStorage (in-memory fallback if it is unavailable). */
export function createBrowserAppStore(): AppStore {
  const storage = browserStorage();
  return createAppStore({
    storage: storage ?? memoryStorage(),
    persistent: storage !== undefined,
    now: () => new Date(),
  });
}

export function useAppStoreApi(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('AppStoreContext is missing; wrap the tree in <AppStoreProvider>');
  return store;
}

/** Selects a slice of app state. Selectors must return stable values (no new objects). */
export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(useAppStoreApi(), selector);
}
