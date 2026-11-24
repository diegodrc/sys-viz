import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { t } from './i18n/pt-BR';
import { systemKey } from './storage/localStore';
import { createTestStore } from './test/store';
import { exampleDoc } from './test/fixtures';
import { testStorage } from './test/storage';

const EXAMPLE_NAME = 'Sistema de exemplo — Pedidos';

function renderApp(storage = testStorage()) {
  const store = createTestStore({ storage });
  const user = userEvent.setup();
  render(<App store={store} />);
  return { store, storage, user };
}

describe('App shell', () => {
  it('A1: first run shows the example opened and listed', async () => {
    renderApp();
    const sidebar = screen.getByRole('complementary', { name: t.systems.title });
    expect(
      within(sidebar).getByRole('button', { name: t.systems.open(EXAMPLE_NAME) }),
    ).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: t.topbar.systemMenu })).toHaveTextContent(
      EXAMPLE_NAME,
    );
    // A2 (component): the macro view renders 9 nodes and 9 edges in React Flow
    await waitFor(() => {
      expect(document.querySelectorAll('.react-flow__node')).toHaveLength(9);
    });
    expect(document.querySelectorAll('.react-flow__edge')).toHaveLength(9);
    expect(screen.getAllByText('×2')).toHaveLength(2);
  });

  it('deleting asks for confirmation with the system name, then shows the empty state', async () => {
    const { user, storage } = renderApp();
    await user.click(screen.getByRole('button', { name: t.systems.remove }));
    const dialog = screen.getByRole('dialog', { name: t.systems.removeTitle });
    expect(dialog).toHaveTextContent(EXAMPLE_NAME);
    await user.click(within(dialog).getByRole('button', { name: t.systems.remove }));
    expect(screen.getByText(t.systems.empty)).toBeInTheDocument();
    expect(storage.getItem(systemKey('exemplo-pedidos'))).toBeNull();
    expect(screen.getByRole('button', { name: t.systems.loadExample })).toBeInTheDocument();
  });

  it('renaming updates the list and the topbar', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: t.systems.rename }));
    const input = screen.getByRole('textbox', { name: t.systems.nameLabel });
    await user.clear(input);
    expect(screen.getByRole('button', { name: t.common.save })).toBeDisabled();
    await user.type(input, 'Pedidos v2{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.topbar.systemMenu })).toHaveTextContent(
      'Pedidos v2',
    );
  });

  it('Esc closes a dialog', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: t.systems.rename }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('A12: importing an invalid JSON lists errors and copies them for the AI', async () => {
    const { user, store } = renderApp();
    const doc = exampleDoc();
    doc.id = 'outro';
    doc.edges[12] = { ...doc.edges[12]!, target: 'exchange-x' };

    await user.click(screen.getByRole('button', { name: t.systems.importButton }));
    const textarea = screen.getByRole('textbox', { name: t.importer.pasteLabel });
    await user.click(textarea);
    await user.paste(JSON.stringify(doc));
    await user.click(
      within(screen.getByRole('dialog', { name: t.importer.title })).getByRole('button', {
        name: t.importer.submit,
      }),
    );

    const dialog = screen.getByRole('dialog', { name: t.importer.errorsTitle(1) });
    expect(dialog).toHaveTextContent('edges[12].target');
    expect(dialog).toHaveTextContent('A aresta "e13" aponta para o nó inexistente "exchange-x".');
    await user.click(within(dialog).getByRole('button', { name: t.importer.copyErrors }));
    expect(await screen.findByText(t.importer.copied)).toBeInTheDocument();
    // user-event installs a clipboard stub on navigator; read back what the app wrote
    expect(await navigator.clipboard.readText()).toBe(
      `${t.importer.aiErrorsHeader}\n- edges[12].target: A aresta "e13" aponta para o nó inexistente "exchange-x".`,
    );
    expect(store.getState().systems).toHaveLength(1);
  });

  it('A13: re-importing the example offers replace / copy / cancel', async () => {
    const { user, store } = renderApp();
    await user.click(screen.getByRole('button', { name: t.systems.importButton }));
    await user.click(screen.getByRole('textbox', { name: t.importer.pasteLabel }));
    await user.paste(JSON.stringify(exampleDoc()));
    await user.click(
      within(screen.getByRole('dialog', { name: t.importer.title })).getByRole('button', {
        name: t.importer.submit,
      }),
    );
    const dialog = screen.getByRole('dialog', { name: t.importer.conflictTitle });
    await user.click(within(dialog).getByRole('button', { name: t.importer.importAsCopy }));
    expect(store.getState().current?.doc.id).toBe('exemplo-pedidos-copia');
  });
});
