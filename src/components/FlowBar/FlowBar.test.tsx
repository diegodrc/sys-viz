import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { t } from '../../i18n/pt-BR';
import { createTestStore, showMacroView } from '../../test/store';

const FLOW = 'Processamento assíncrono';

async function setup() {
  const store = createTestStore();
  const user = userEvent.setup();
  render(<App store={store} />);
  await showMacroView(store);
  await user.selectOptions(screen.getByRole('combobox', { name: t.flows.selector }), FLOW);
  // move focus off the <select> so ←/→ reach the step bar (SPEC §6.4)
  (document.activeElement as HTMLElement | null)?.blur(); // activeElement is the select here
  return { store, user };
}

function badges(): string[] {
  return screen.queryAllByTestId('step-badge').map((b) => b.textContent ?? '');
}

describe('flows UI (SPEC §6.5)', () => {
  it('A6: selecting the flow in the macro view shows 5 badges and keeps the expansion', async () => {
    const { store } = await setup();
    await waitFor(() => expect(badges().sort()).toEqual(['14', '2', '3', '6,10', '8,12']));
    expect(store.getState().current?.expanded.size).toBe(0);
    expect(screen.getByRole('button', { name: t.flows.expandPath })).toBeVisible();
    expect(screen.getByRole('toolbar', { name: t.flows.bar })).toHaveTextContent(
      t.flows.notStarted(FLOW, 14),
    );
  });

  it('A7: "Expandir caminho" shows all 14 flow edges individually', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: t.flows.expandPath }));
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node')).toHaveLength(25));
    await waitFor(() => expect(badges()).toHaveLength(14));
    expect(badges().every((b) => /^\d+$/.test(b))).toBe(true);
  });

  it('A8: → up to step 6 emphasizes e13; the panel shows "Ramo A." and rk-a', async () => {
    const { store, user } = await setup();
    for (let i = 0; i < 6; i++) await user.keyboard('{ArrowRight}');
    const bar = screen.getByRole('toolbar', { name: t.flows.bar });
    expect(bar).toHaveTextContent(t.flows.stepOf(6, 14, 'Ramo A.'));
    expect(store.getState().selection).toEqual({ kind: 'docEdge', id: 'e13' });
    const panel = screen.getByRole('complementary', { name: t.details.panel });
    expect(within(panel).getByText('Ramo A.')).toBeInTheDocument();
    expect(within(panel).getByText('routingKey')).toBeInTheDocument();
    expect(within(panel).getAllByText('rk-a').length).toBeGreaterThan(0);
    // the rendered edge holding e13 is the current one
    await waitFor(() =>
      expect(screen.getAllByTestId('step-badge').find((b) => b.textContent === '6,10')).toHaveClass(
        'ring-2',
      ),
    );
    await user.keyboard('{ArrowLeft}');
    expect(bar).toHaveTextContent(t.flows.stepOf(5, 14, 'consulta dados'));
  });

  it('arrows are ignored while typing in an input', async () => {
    const { store, user } = await setup();
    await user.click(screen.getByRole('button', { name: t.systems.rename }));
    await user.keyboard('{ArrowRight}');
    expect(store.getState().activeFlow?.step).toBeUndefined();
  });

  it('a hidden step offers "Expandir"; ✕ closes the flow', async () => {
    const { store, user } = await setup();
    await user.click(screen.getByRole('button', { name: t.flows.next }));
    const bar = screen.getByRole('toolbar', { name: t.flows.bar });
    expect(bar).toHaveTextContent(t.flows.hiddenStep('Sistema Pedidos'));
    await user.click(within(bar).getByRole('button', { name: t.flows.reveal }));
    expect([...(store.getState().current?.expanded ?? [])].sort()).toEqual([
      'db-pedidos',
      'sistema-pedidos',
    ]);
    await user.click(screen.getByRole('button', { name: t.flows.close }));
    expect(store.getState().activeFlow).toBeUndefined();
    expect(screen.queryByRole('toolbar', { name: t.flows.bar })).not.toBeInTheDocument();
  });
});
