import { useEffect, useSyncExternalStore } from 'react';
import type { Theme } from '../storage/localStore';

export type ResolvedTheme = 'light' | 'dark';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(callback: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

/**
 * Resolves "system" against the OS preference and applies the theme to `<html data-theme>`
 * (SPEC §6.4, §11.7). Returns the resolved theme for components such as React Flow.
 */
export function useResolvedTheme(theme: Theme): ResolvedTheme {
  const dark = useSyncExternalStore(subscribe, systemPrefersDark, () => false);
  const resolved: ResolvedTheme = theme === 'system' ? (dark ? 'dark' : 'light') : theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
  return resolved;
}
