import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { t } from '../../i18n/pt-BR';
import { PREFS_KEY } from '../../storage/localStore';
import { createTestStore, showMacroView } from '../../test/store';
import { testStorage } from '../../test/storage';

async function setup() {
  const storage = testStorage();
  const store = createTestStore({ storage });
  const user = userEvent.setup();
  render(<App store={store} />);
  await showMacroView(store);
  return { store, storage, user };
}

function nodeEl(id: string): HTMLElement | null {
  return document.querySelector(`.react-flow__node[data-id="${id}"]`);
}

describe('search (SPEC §6.4)', () => {
  it('A15: "/" focuses search; "worker" lists the hierarchical path; choosing it expands, selects and pulses', async () => {
    const { store, user } = await setup();
    await user.keyboard('/');
    const input = screen.getByRole('combobox', { name: t.search.label });
    expect(input).toHaveFocus();
    await user.type(input, 'worker');
    const option = screen.getByRole('option', { name: 'Sistema Pedidos › Worker Fila Pedidos' });
    await user.click(option);

    expect(store.getState().current?.expanded.has('sistema-pedidos')).toBe(true);
    expect(store.getState().selection).toEqual({ kind: 'node', id: 'worker-pedidos' });
    expect(store.getState().pulse?.id).toBe('worker-pedidos');
    await waitFor(() =>
      expect(nodeEl('worker-pedidos')?.querySelector('.sv-pulse')).not.toBeNull(),
    );
    await waitFor(() => expect(store.getState().pulse).toBeUndefined(), { timeout: 3000 });
  });

  it('accent-insensitive search with keyboard selection', async () => {
    const { store, user } = await setup();
    const input = screen.getByRole('combobox', { name: t.search.label });
    await user.type(input, 'validacao');
    const list = screen.getByRole('listbox', { name: t.search.results });
    expect(within(list).getAllByRole('option')).toHaveLength(4);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(store.getState().selection).toEqual({ kind: 'node', id: 'ingress-validacao' });
  });
});

describe('filters (SPEC §6.4)', () => {
  it('A16: type=database dims everything but the systems that contain databases', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: t.filters.button }));
    await user.click(screen.getByRole('checkbox', { name: t.nodeTypes.database }));
    await waitFor(() => expect(nodeEl('apigee')?.style.opacity).toBe('0.25'));
    expect(nodeEl('sistema-pedidos')?.style.opacity).toBe('');
    expect(nodeEl('sistema-validacao')?.style.opacity).toBe('');
    for (const id of [
      'usuario',
      'akamai',
      'portal-web',
      'ca-gateway',
      'rabbitmq',
      'sistema-externo',
    ]) {
      expect(nodeEl(id)?.style.opacity).toBe('0.25');
    }
    // active indicator + clear
    await user.click(screen.getByRole('button', { name: t.filters.clear }));
    await waitFor(() => expect(nodeEl('apigee')?.style.opacity).toBe(''));
  });

  it('filter and flow dimming combine with the minimum opacity', async () => {
    const { store, user } = await setup();
    act(() => store.getState().selectFlow('fluxo-processamento'));
    await waitFor(() => expect(nodeEl('apigee')?.style.opacity).toBe('0.3'));
    await user.click(screen.getByRole('button', { name: t.filters.button }));
    await user.click(screen.getByRole('checkbox', { name: t.nodeTypes.database }));
    // apigee: flow 30% and filter 25% -> 25%; ca-gateway: on the path, filter 25% -> 25%
    await waitFor(() => expect(nodeEl('apigee')?.style.opacity).toBe('0.25'));
    expect(nodeEl('ca-gateway')?.style.opacity).toBe('0.25');
    expect(nodeEl('sistema-validacao')?.style.opacity).toBe('');
  });
});

describe('levels, legend, theme, Esc (SPEC §6.4)', () => {
  it('levels menu: expand all, to level 2, collapse all', async () => {
    const { store, user } = await setup();
    const open = () => user.click(screen.getByRole('button', { name: t.levels.button }));
    await open();
    await user.click(screen.getByRole('button', { name: t.levels.expandAll }));
    expect(store.getState().current?.expanded.size).toBe(5);
    await open();
    await user.click(screen.getByRole('button', { name: t.levels.expandTo(2) }));
    expect(store.getState().current?.expanded.size).toBe(4);
    await open();
    expect(screen.getByRole('button', { name: t.levels.expandTo(3) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.levels.expandTo(4) })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.levels.collapseAll }));
    expect(store.getState().current?.expanded.size).toBe(0);
  });

  it('legend lists node types present and edge styles', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: t.legend.button }));
    const legend = screen.getByRole('dialog', { name: t.legend.button });
    expect(within(legend).getByText(t.nodeTypes.database)).toBeInTheDocument();
    expect(within(legend).queryByText(t.nodeTypes.cache)).not.toBeInTheDocument();
    for (const style of [t.legend.sync, t.legend.async, t.legend.assumed, t.legend.aggregated]) {
      expect(within(legend).getByText(style)).toBeInTheDocument();
    }
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: t.legend.button })).not.toBeInTheDocument();
  });

  it('theme toggles light → dark → system and is persisted', async () => {
    const { storage, user } = await setup();
    const button = () => screen.getByRole('button', { name: /^Tema:/ });
    await user.click(button()); // system -> light
    expect(document.documentElement.dataset.theme).toBe('light');
    await user.click(button()); // light -> dark
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(JSON.parse(storage.getItem(PREFS_KEY) ?? '{}')).toMatchObject({ theme: 'dark' });
  });

  it('Esc first leaves a field, then clears the selection', async () => {
    const { store, user } = await setup();
    act(() => store.getState().select({ kind: 'node', id: 'apigee' }));
    const input = screen.getByRole('combobox', { name: t.search.label });
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(input).not.toHaveFocus();
    expect(store.getState().selection).toBeDefined();
    await user.keyboard('{Escape}');
    expect(store.getState().selection).toBeUndefined();
  });
});
