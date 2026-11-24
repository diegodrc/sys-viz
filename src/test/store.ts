import { createDirectEngine } from '../layout/engine';
import { createAppStore, type AppDeps, type AppStore } from '../store/appStore';
import { testStorage } from './storage';

/** App store for tests: in-memory storage and ELK on the main thread. */
export function createTestStore(overrides: Partial<AppDeps> = {}): AppStore {
  return createAppStore({
    storage: testStorage(),
    persistent: true,
    now: () => new Date(),
    layout: createDirectEngine(),
    ...overrides,
  });
}
