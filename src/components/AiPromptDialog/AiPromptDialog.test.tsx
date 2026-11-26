import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { t } from '../../i18n/pt-BR';
import { buildCreatePrompt } from '../../prompts/createPrompt';
import { createTestStore, showMacroView } from '../../test/store';

async function setup() {
  const store = createTestStore();
  const user = userEvent.setup();
  render(<App store={store} />);
  await showMacroView(store);
  return { store, user };
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog', { name: t.ai.title });
}

describe('Gerar com IA (SPEC §9.1)', () => {
  it('shows the create prompt with instructions and copies it', async () => {
    const { user } = await setup();
    await user.click(screen.getAllByRole('button', { name: t.ai.button })[0]!);
    const text = within(dialog()).getByRole('tabpanel');
    expect(text).toHaveValue(buildCreatePrompt());
    expect(within(dialog()).getByText(t.ai.instructions)).toBeInTheDocument();
    await user.click(within(dialog()).getByRole('button', { name: t.ai.copy }));
    expect(await within(dialog()).findByText(t.ai.copied)).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(buildCreatePrompt());
  });

  it('A17: "Evoluir sistema atual" embeds the current JSON without layout and copies it all', async () => {
    const { store, user } = await setup();
    act(() => store.getState().dropNode('apigee', { x: 10, y: 20 })); // gives the doc a layout
    expect(store.getState().current?.doc.layout?.positions?.apigee).toBeDefined();

    await user.click(screen.getAllByRole('button', { name: t.ai.button })[0]!);
    await user.click(within(dialog()).getByRole('tab', { name: t.ai.tabEvolve }));
    const value = within(dialog()).getByRole<HTMLTextAreaElement>('tabpanel').value;
    const current = value.slice(value.indexOf('## Documento atual'));
    expect(current).toContain('"id": "exemplo-pedidos"');
    expect(current).not.toContain('"layout"');

    await user.click(within(dialog()).getByRole('button', { name: t.ai.copy }));
    expect(await navigator.clipboard.readText()).toBe(value);
  });

  it('"Importar JSON" switches to the import dialog', async () => {
    const { user } = await setup();
    await user.click(screen.getAllByRole('button', { name: t.ai.button })[0]!);
    await user.click(within(dialog()).getByRole('button', { name: t.ai.importJson }));
    expect(screen.queryByRole('dialog', { name: t.ai.title })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t.importer.title })).toBeInTheDocument();
  });

  it('the evolve tab is disabled without an open system', async () => {
    const { store, user } = await setup();
    act(() => store.getState().closeSystem());
    await user.click(screen.getAllByRole('button', { name: t.ai.button })[0]!);
    expect(within(dialog()).getByRole('tab', { name: t.ai.tabEvolve })).toBeDisabled();
  });
});

describe('Sobre/Ajuda', () => {
  it('shows the file:// storage note', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: t.about.button }));
    const about = screen.getByRole('dialog', { name: t.about.title });
    expect(within(about).getByText(t.about.fileNote)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: t.about.title })).not.toBeInTheDocument();
  });
});
