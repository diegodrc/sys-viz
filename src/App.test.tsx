import { render, screen } from '@testing-library/react';
import { App } from './App';
import { t } from './i18n/pt-BR';

describe('App', () => {
  it('renders the app name', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: t.app.name })).toBeInTheDocument();
  });

  it('provides ResizeObserver and DOMMatrixReadOnly in jsdom', () => {
    expect(typeof ResizeObserver).toBe('function');
    expect(new DOMMatrixReadOnly('scale(2)').m22).toBe(2);
  });
});
