import { Component, type ReactNode } from 'react';
import { t } from '../i18n/pt-BR';

interface Props {
  /** Called by "Voltar à lista de sistemas"; should leave the failing view. */
  onReset: () => void;
  /** Changing this key clears a previous error (e.g. another system was opened). */
  resetKey: string | undefined;
  children: ReactNode;
}

interface State {
  failedKey: string | undefined | null;
}

/** Catches render errors so a bad document never blanks the app (SPEC §11.3). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failedKey: null };

  static getDerivedStateFromError(): Partial<State> {
    return { failedKey: undefined };
  }

  componentDidCatch(): void {
    this.setState({ failedKey: this.props.resetKey });
  }

  componentDidUpdate(previous: Props): void {
    if (this.state.failedKey !== null && previous.resetKey !== this.props.resetKey) {
      this.setState({ failedKey: null });
    }
  }

  render() {
    if (this.state.failedKey === null) return this.props.children;
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <p className="font-medium">{t.errorBoundary.title}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            this.setState({ failedKey: null });
            this.props.onReset();
          }}
        >
          {t.errorBoundary.back}
        </button>
      </div>
    );
  }
}
