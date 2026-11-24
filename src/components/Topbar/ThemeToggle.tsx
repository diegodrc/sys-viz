import { Monitor, Moon, Sun } from 'lucide-react';
import { t } from '../../i18n/pt-BR';
import type { Theme } from '../../storage/localStore';
import { useApp } from '../../store/context';

const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/** Cycles light → dark → system; persisted in prefs (SPEC §6.4). */
export function ThemeToggle() {
  const theme = useApp((s) => s.prefs.theme);
  const setTheme = useApp((s) => s.setTheme);
  const Icon = ICONS[theme];
  const label = t.theme.button(t.theme[theme]);
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(NEXT[theme])}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
