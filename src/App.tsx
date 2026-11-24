import { t } from './i18n/pt-BR';

export function App() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2 bg-bg text-text">
      <h1 className="text-2xl font-semibold">{t.app.name}</h1>
      <p className="text-text-muted">{t.app.tagline}</p>
    </main>
  );
}
