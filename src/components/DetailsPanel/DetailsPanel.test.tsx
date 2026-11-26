import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { t } from '../../i18n/pt-BR';
import { systemKey } from '../../storage/localStore';
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

function panel(): HTMLElement {
  return screen.getByRole('complementary', { name: t.details.panel });
}

describe('DetailsPanel (SPEC §6.6)', () => {
  it('A11: editing a node name updates the canvas, storage and export; id is not editable', async () => {
    const { store, storage, user } = await setup();
    act(() => store.getState().focusNode('api-pedidos'));
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node')).toHaveLength(13));

    const details = panel();
    expect(within(details).getByText('api-pedidos')).toBeInTheDocument();
    await user.click(within(details).getByRole('button', { name: t.details.edit }));
    // the form has no id field
    expect(within(panel()).queryByDisplayValue('api-pedidos')).not.toBeInTheDocument();

    const name = within(panel()).getByRole('textbox', { name: t.details.fields.name });
    await user.clear(name);
    expect(within(panel()).getByRole('button', { name: t.common.save })).toBeDisabled();
    expect(within(panel()).getByText('O texto não pode ser vazio.')).toBeInTheDocument();
    await user.type(name, 'API Orders');
    await user.click(within(panel()).getByRole('button', { name: t.common.save }));

    // back to read mode, canvas card renamed, persisted and exportable
    expect(within(panel()).getByRole('button', { name: t.details.edit })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        document.querySelector('.react-flow__node[data-id="api-pedidos"]')?.textContent,
      ).toContain('API Orders'),
    );
    const stored = storage.getItem(systemKey('exemplo-pedidos')) ?? '';
    expect(stored).toContain('"name":"API Orders"');
    expect(JSON.stringify(store.getState().exportableSystem('exemplo-pedidos'))).toContain(
      'API Orders',
    );
  });

  it('Cancel discards the draft', async () => {
    const { store, user } = await setup();
    act(() => store.getState().select({ kind: 'node', id: 'apigee' }));
    await user.click(within(panel()).getByRole('button', { name: t.details.edit }));
    const name = within(panel()).getByRole('textbox', { name: t.details.fields.name });
    await user.clear(name);
    await user.type(name, 'Outro');
    await user.click(within(panel()).getByRole('button', { name: t.common.cancel }));
    expect(store.getState().current?.doc.nodes[3]?.name).toBe('Apigee');
  });

  it('an aggregated edge lists its originals; choosing one opens it', async () => {
    const { store, user } = await setup();
    act(() => store.getState().select({ kind: 'edge', id: 'sistema-validacao->rabbitmq' }));
    expect(
      within(panel()).getByRole('heading', { name: t.details.kinds.aggregated(2) }),
    ).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: /Exchange B/ }));
    expect(store.getState().selection).toEqual({ kind: 'docEdge', id: 'e14' });
    expect(within(panel()).getByText('rk-b')).toBeInTheDocument();
  });

  it('system details open from the topbar menu and edit name/description', async () => {
    const { store, user } = await setup();
    await user.click(screen.getByRole('button', { name: t.topbar.systemMenu }));
    await user.click(screen.getByRole('menuitem', { name: t.topbar.systemDetails }));
    expect(
      within(panel()).getByRole('heading', { name: t.details.kinds.system }),
    ).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: t.details.edit }));
    const description = within(panel()).getByRole('textbox', {
      name: t.details.fields.description,
    });
    await user.clear(description);
    await user.click(within(panel()).getByRole('button', { name: t.common.save }));
    expect(store.getState().current?.doc.description).toBeUndefined();
  });

  it('links open safely only for http(s); other URLs are plain text', async () => {
    const { store } = await setup();
    act(() => {
      const ok = store.getState().updateNode({
        id: 'apigee',
        name: 'Apigee',
        type: 'gateway',
        links: [
          { label: 'Console', url: 'https://example.com' },
          { label: 'Script', url: 'javascript:alert(1)' },
        ],
      });
      expect(ok).toBe(true);
      store.getState().select({ kind: 'node', id: 'apigee' });
    });
    const link = within(panel()).getByRole('link', { name: 'Console' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(panel()).queryByRole('link', { name: /Script/ })).not.toBeInTheDocument();
    expect(within(panel()).getByText('Script')).toBeInTheDocument();
  });

  it('clicking a child navigates: expands and selects it', async () => {
    const { store, user } = await setup();
    act(() => store.getState().select({ kind: 'node', id: 'rabbitmq' }));
    await user.click(within(panel()).getByRole('button', { name: 'Fila A' }));
    expect(store.getState().selection).toEqual({ kind: 'node', id: 'fila-a' });
    expect(store.getState().current?.expanded.has('rabbitmq')).toBe(true);
  });

  it('the close button clears the selection', async () => {
    const { store, user } = await setup();
    act(() => store.getState().select({ kind: 'node', id: 'apigee' }));
    await user.click(screen.getByRole('button', { name: t.details.close }));
    expect(store.getState().selection).toBeUndefined();
    expect(screen.queryByRole('complementary', { name: t.details.panel })).not.toBeInTheDocument();
  });
});
