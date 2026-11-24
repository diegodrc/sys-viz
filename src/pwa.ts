// Service worker registration for the hosted PWA build only (never in the single-file build).
export async function registerServiceWorker(): Promise<void> {
  if (import.meta.env.MODE === 'single' || import.meta.env.DEV) return;
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ immediate: true });
}
