import { act, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
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

const renderedNodes = (): number => document.querySelectorAll('.react-flow__node').length;

/**
 * The app opens a system fully expanded (27 nodes for the example, DECISIONS 2026-11-25); tests
 * of the macro view wait for that, then "Colapsar tudo" and wait for the 9 macro nodes.
 */
export async function showMacroView(store: AppStore): Promise<void> {
  await waitFor(() => expect(renderedNodes()).toBe(27));
  act(() => store.getState().setExpanded([]));
  await waitFor(() => expect(renderedNodes()).toBe(9));
}
