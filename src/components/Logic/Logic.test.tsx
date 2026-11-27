import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { t } from '../../i18n/pt-BR';
import { createTestStore } from '../../test/store';
import { testStorage } from '../../test/storage';

const nodes = (): number => document.querySelectorAll('.react-flow__node').length;
const nodeEl = (id: string): HTMLElement | null =>
  document.querySelector(`.react-flow__node[data-id="${id}"]`);
const trail = (): HTMLElement => screen.getByRole('navigation', { name: t.logic.trail });

async function setup(storage = testStorage()) {
  const store = createTestStore({ storage });
  const user = userEvent.setup();
  render(<App store={store} />);
  // the example opens fully expanded (27 nodes, DECISIONS 2026-11-25)
  await waitFor(() => expect(nodes()).toBe(27));
  return { store, storage, user };
}

async function openE11(store: Awaited<ReturnType<typeof setup>>['store']): Promise<void> {
  act(() => store.getState().openLogic('e11'));
  await waitFor(() => expect(nodes()).toBe(11));
}

describe('map indicators (SPEC §18.6)', () => {
  it('L3: logic icons on e11/e17, badges on the handler nodes, summed on collapsed groups', async () => {
    const { store } = await setup();
    await waitFor(() => expect(screen.getAllByTestId('logic-icon')).toHaveLength(2));
    const badge = (id: string) => nodeEl(id)?.querySelector('[data-testid="handler-badge"]');
    expect(badge('api-validacao')).toHaveTextContent('1');
    expect(badge('consumer-a')).toHaveTextContent('1');
    expect(badge('sistema-validacao')).toBeNull();

    act(() => store.getState().setExpanded([]));
    await waitFor(() => expect(nodes()).toBe(9));
    expect(badge('sistema-validacao')).toHaveTextContent('2');
    expect(badge('sistema-pedidos')).toBeNull();
  });

  it('the edge panel lists where the edge is used in logic', async () => {
    const { store } = await setup();
    act(() => store.getState().select({ kind: 'docEdge', id: 'e12' }));
    const panel = screen.getByRole('complementary', { name: t.details.panel });
    expect(within(panel).getByRole('button', { name: /Busca dados do pedido/ })).toHaveTextContent(
      'API Validação › POST /validacoes › Busca dados do pedido e do cliente',
    );
    // e12 has no handler of its own
    expect(within(panel).queryByRole('button', { name: t.logic.open })).toBeNull();
  });
});

describe('logic view (SPEC §18.7)', () => {
  it('L4: "Abrir lógica" in the e11 panel shows 11 steps, 11 transitions and the trail', async () => {
    const { store, user } = await setup();
    act(() => store.getState().select({ kind: 'docEdge', id: 'e11' }));
    await user.click(screen.getByRole('button', { name: t.logic.open }));
    await waitFor(() => expect(nodes()).toBe(11));
    await waitFor(() => expect(document.querySelectorAll('.react-flow__edge')).toHaveLength(11));
    expect(trail()).toHaveTextContent('API Validação › POST /validacoes');
    expect(nodeEl('val-campos-ok')?.querySelector('polygon')).not.toBeNull();
    expect(
      screen
        .getAllByTestId('transition-label')
        .map((l) => l.textContent)
        .sort(),
    ).toEqual(['não', 'não', 'sim', 'sim']);
  });

  it('L5: the e12 chip goes back to the map with the edge selected, its ends visible and pulsing', async () => {
    const { store, user } = await setup();
    act(() => store.getState().setExpanded([]));
    await waitFor(() => expect(nodes()).toBe(9));
    await openE11(store);
    await user.click(screen.getByRole('button', { name: t.logic.showEdge('consulta dados') }));

    expect(store.getState().logic).toBeUndefined();
    expect(store.getState().selection).toEqual({ kind: 'docEdge', id: 'e12' });
    expect(store.getState().current?.expanded.has('sistema-validacao')).toBe(true);
    await waitFor(() =>
      expect(document.querySelector('.react-flow__edge.selected')?.getAttribute('data-id')).toBe(
        'api-validacao->db-validacao',
      ),
    );
    expect(document.querySelector('.sv-edge-pulse')).not.toBeNull();
    await waitFor(() => expect(store.getState().edgePulse).toBeUndefined(), { timeout: 3000 });
  });

  it('L6: the subprocess opens as a new trail level with "Usado em"; Esc goes back', async () => {
    const { store, user } = await setup();
    await openE11(store);
    await user.click(
      screen.getByRole('button', { name: t.logic.openSubprocess('Calcula aprovação') }),
    );
    await waitFor(() => expect(nodes()).toBe(5));
    expect(trail()).toHaveTextContent('API Validação › POST /validacoes › Calcula aprovação');
    const panel = screen.getByRole('complementary', { name: t.details.panel });
    expect(panel).toHaveTextContent(t.logic.usedInSubprocess);
    expect(
      within(panel).getByRole('button', {
        name: 'API Validação › POST /validacoes › Calcula aprovação',
      }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(nodes()).toBe(11));
    expect(store.getState().logic?.trail).toEqual([{ kind: 'handler', edgeId: 'e11' }]);
    await user.keyboard('{Escape}');
    expect(store.getState().logic).toBeUndefined();
    await waitFor(() => expect(nodes()).toBe(27));
  });

  it('L11: the trigger filter dims every other step', async () => {
    const { store, user } = await setup();
    await openE11(store);
    await user.click(screen.getByRole('button', { name: t.logic.filterTitle }));
    await user.click(screen.getByRole('checkbox', { name: t.logic.categories.trigger }));
    await waitFor(() => expect(nodeEl('val-campos')?.style.opacity).toBe('0.25'));
    expect(nodeEl('val-publica-aprovacao')?.style.opacity).toBe('');
    expect(nodeEl('val-publica-pendencia')?.style.opacity).toBe('');
    const lit = [...document.querySelectorAll<HTMLElement>('.react-flow__node')].filter(
      (n) => n.style.opacity === '',
    );
    expect(lit.map((n) => n.dataset.id).sort()).toEqual([
      'val-publica-aprovacao',
      'val-publica-pendencia',
    ]);
  });

  it('L12: editing a step title persists; ids, edges and transitions are not editable', async () => {
    const { store, storage, user } = await setup();
    act(() => store.getState().openLogic('e11', { stepId: 'val-prazo' }));
    await waitFor(() => expect(nodes()).toBe(11));
    const panel = screen.getByRole('complementary', { name: t.details.panel });
    await user.click(within(panel).getByRole('button', { name: t.details.edit }));
    expect(within(panel).queryByRole('textbox', { name: t.details.fields.id })).toBeNull();
    const title = within(panel).getByRole('textbox', { name: t.logic.fields.title });
    await user.clear(title);
    await user.type(title, 'Prazo padrão de 30 dias');
    await user.click(within(panel).getByRole('button', { name: t.common.save }));

    const step = (doc = store.getState().current?.doc) =>
      doc?.logic?.handlers?.[0]?.steps.find((s) => s.id === 'val-prazo');
    expect(step()?.title).toBe('Prazo padrão de 30 dias');
    expect(store.getState().exportableSystem('exemplo-pedidos')?.logic?.handlers?.[0]).toEqual(
      expect.objectContaining({ transitions: expect.any(Array) as unknown }),
    );
    // reload: a new store over the same storage
    const reloaded = createTestStore({ storage });
    act(() => reloaded.getState().init());
    expect(step(reloaded.getState().current?.doc)?.title).toBe('Prazo padrão de 30 dias');
  });

  it('a category change that would break the logic is rejected with a notice', async () => {
    const { store } = await setup();
    const handler = store.getState().current?.doc.logic?.handlers?.[0];
    const start = handler?.steps[0];
    if (!start) throw new Error('example has a start step');
    let ok = true;
    act(() => {
      ok = store
        .getState()
        .updateLogicStep({ kind: 'handler', edgeId: 'e11' }, { ...start, category: 'rule' });
    });
    expect(ok).toBe(false);
    expect(store.getState().notice?.message).toContain('exatamente um passo "start"');
    expect(store.getState().current?.doc.logic?.handlers?.[0]?.steps[0]?.category).toBe('start');
  });
});

describe('"Seguir" (SPEC §18.8)', () => {
  it('L7: following the approval opens Consumer A and extends the trail', async () => {
    const { store, user } = await setup();
    await openE11(store);
    await user.click(screen.getByRole('button', { name: t.logic.follow('Consumer A') }));
    await waitFor(() => expect(nodes()).toBe(3));
    expect(trail()).toHaveTextContent(
      'API Validação › POST /validacoes › Consumer A › Mensagem de aprovação (rk-a)',
    );
    expect(store.getState().logic?.trail).toHaveLength(2);
  });

  it('L8: following the pendency is disabled because Consumer B has no logic', async () => {
    const { store } = await setup();
    await openE11(store);
    const wrapper = screen.getByTestId('follow-disabled');
    expect(wrapper).toHaveAttribute('title', t.logic.followNone('Consumer B'));
    expect(within(wrapper).getByRole('button')).toBeDisabled();
  });
});

describe('"Ver lógica" in the step bar (SPEC §18.6)', () => {
  it('L9: shown on steps 4 (e11) and 8 (e17), not on step 5 (e12)', async () => {
    const { store, user } = await setup();
    act(() => store.getState().selectFlow('fluxo-processamento'));
    const bar = (): HTMLElement => screen.getByRole('toolbar', { name: t.flows.bar });
    const viewLogic = () => within(bar()).queryByRole('button', { name: t.logic.viewLogic });
    act(() => store.getState().goToStep(3));
    expect(viewLogic()).not.toBeNull();
    act(() => store.getState().goToStep(4));
    expect(viewLogic()).toBeNull();
    act(() => store.getState().goToStep(7));
    expect(viewLogic()).not.toBeNull();
    await user.click(viewLogic()!);
    await waitFor(() => expect(nodes()).toBe(3));
    expect(store.getState().logic?.trail).toEqual([{ kind: 'handler', edgeId: 'e17' }]);
  });
});

describe('field search (SPEC §18.9)', () => {
  it('L10: "prazo" lists pedido.prazo under Campos and opens the logic with the step pulsing', async () => {
    const { store, user } = await setup();
    await user.type(screen.getByRole('combobox', { name: t.search.label }), 'prazo');
    const list = screen.getByRole('listbox', { name: t.search.results });
    expect(list).toHaveTextContent(t.search.groupFields);
    const option = within(list).getByRole('option', { name: /pedido\.prazo/ });
    expect(option).toHaveTextContent(
      t.search.fieldResult('pedido.prazo', t.logic.roles.write, 'Sem prazo informado, usa 30 dias'),
    );
    expect(option).toHaveTextContent('API Validação › POST /validacoes');
    await user.click(option);
    await waitFor(() => expect(nodes()).toBe(11));
    expect(store.getState().logic?.selection).toEqual({ kind: 'step', id: 'val-prazo' });
    await waitFor(() => expect(nodeEl('val-prazo')?.querySelector('.sv-pulse')).not.toBeNull());
  });

  it('a component result chosen in the logic view goes back to the map', async () => {
    const { store, user } = await setup();
    await openE11(store);
    await user.type(screen.getByRole('combobox', { name: t.search.label }), 'worker');
    await user.click(screen.getByRole('option', { name: 'Sistema Pedidos › Worker Fila Pedidos' }));
    expect(store.getState().logic).toBeUndefined();
    expect(store.getState().selection).toEqual({ kind: 'node', id: 'worker-pedidos' });
  });
});
