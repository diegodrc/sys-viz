import { describe, expect, it } from 'vitest';
import { toExportJson } from '../storage/backup';
import { INDEX_KEY, PREFS_KEY, systemKey, uiKey } from '../storage/localStore';
import { exampleDoc } from '../test/fixtures';
import { testStorage, type TestStorage } from '../test/storage';
import { createAppStore } from './appStore';

let clock = Date.parse('2026-11-24T12:00:00.000Z');

function setup(storage: TestStorage = testStorage()) {
  const store = createAppStore({ storage, persistent: true, now: () => new Date((clock += 1000)) });
  return { store, storage, s: () => store.getState() };
}

function backupText(...docs: ReturnType<typeof exampleDoc>[]): string {
  return JSON.stringify({ sysvizBackup: 1, exportedAt: '2026-01-01T00:00:00.000Z', systems: docs });
}

describe('startup', () => {
  it('A1: first run with empty storage loads and opens the example', () => {
    const { s, storage } = setup();
    s().init();
    expect(s().ready).toBe(true);
    expect(s().current?.doc.id).toBe('exemplo-pedidos');
    expect(s().current?.expanded.size).toBe(0);
    expect(s().systems.map((e) => e.id)).toEqual(['exemplo-pedidos']);
    expect(Object.keys(storage.dump()).sort()).toEqual(
      [INDEX_KEY, PREFS_KEY, systemKey('exemplo-pedidos')].sort(),
    );
  });

  it('later runs reopen lastOpenedId with its expansion state', () => {
    const first = setup();
    first.s().init();
    first.storage.setItem(
      uiKey('exemplo-pedidos'),
      JSON.stringify({ expandedIds: ['rabbitmq', 'ghost'] }),
    );

    const second = setup(first.storage);
    second.s().init();
    expect(second.s().current?.doc.id).toBe('exemplo-pedidos');
    expect([...(second.s().current?.expanded ?? [])]).toEqual(['rabbitmq']);
  });

  it('does not reload the example when the user deleted every system', () => {
    const first = setup();
    first.s().init();
    first.s().deleteSystem('exemplo-pedidos');

    const second = setup(first.storage);
    second.s().init();
    expect(second.s().systems).toEqual([]);
    expect(second.s().current).toBeUndefined();
  });

  it('corrupted entries are listed and can be removed', () => {
    const storage = testStorage({ [systemKey('quebrado')]: '{oops', [INDEX_KEY]: '{}' });
    const { s } = setup(storage);
    s().init();
    expect(s().corrupted).toEqual([{ id: 'quebrado', raw: '{oops' }]);
    expect(s().rawSystemText('quebrado')).toBe('{oops');
    s().removeCorrupted('quebrado');
    expect(s().corrupted).toEqual([]);
    expect(storage.getItem(systemKey('quebrado'))).toBeNull();
  });
});

describe('sidebar actions', () => {
  it('rename persists and updates the open doc; empty names are rejected', () => {
    const { s, storage } = setup();
    s().init();
    expect(s().renameSystem('exemplo-pedidos', '   ')).toBe(false);
    expect(s().renameSystem('exemplo-pedidos', ' Novo ')).toBe(true);
    expect(s().current?.doc.name).toBe('Novo');
    expect(JSON.parse(storage.getItem(systemKey('exemplo-pedidos')) ?? '{}')).toMatchObject({
      name: 'Novo',
    });
  });

  it('duplicate creates -copia without copying expansion state', () => {
    const { s, storage } = setup();
    s().init();
    storage.setItem(uiKey('exemplo-pedidos'), JSON.stringify({ expandedIds: ['rabbitmq'] }));
    s().duplicateSystem('exemplo-pedidos');
    s().duplicateSystem('exemplo-pedidos');
    expect(
      s()
        .systems.map((e) => e.id)
        .sort(),
    ).toEqual(['exemplo-pedidos', 'exemplo-pedidos-copia', 'exemplo-pedidos-copia-2']);
    expect(storage.getItem(uiKey('exemplo-pedidos-copia'))).toBeNull();
  });

  it('delete removes the open system and its keys', () => {
    const { s, storage } = setup();
    s().init();
    s().deleteSystem('exemplo-pedidos');
    expect(s().current).toBeUndefined();
    expect(storage.getItem(systemKey('exemplo-pedidos'))).toBeNull();
  });

  it('quota error keeps the previous state and shows a message', () => {
    const { s, storage } = setup();
    s().init();
    storage.failWritesTo((key) => key.startsWith('sysviz:system:'));
    expect(s().renameSystem('exemplo-pedidos', 'Outro')).toBe(false);
    expect(s().current?.doc.name).toBe('Sistema de exemplo — Pedidos');
    expect(s().notice).toMatchObject({ kind: 'error' });
    expect(s().notice?.message).toContain('Exporte um backup');
  });

  it('systems are sorted by last opened', () => {
    const { s } = setup();
    s().init();
    s().duplicateSystem('exemplo-pedidos');
    s().openSystem('exemplo-pedidos-copia');
    expect(s().systems[0]?.id).toBe('exemplo-pedidos-copia');
  });
});

describe('import flow (SPEC §6.2)', () => {
  it('A12: invalid JSON imports nothing and lists errors', () => {
    const { s } = setup();
    s().init();
    const doc = exampleDoc();
    doc.id = 'outro';
    doc.edges[0] = { ...doc.edges[0]!, target: 'nao-existe' };
    s().openImport();
    s().importText(JSON.stringify(doc));
    const importer = s().importer;
    expect(importer?.step).toBe('errors');
    expect(s().systems).toHaveLength(1);
  });

  it('a new id is imported and opened; warnings become a notice', () => {
    const { s } = setup();
    s().init();
    const doc = { ...exampleDoc(), id: 'novo', extra: true };
    s().openImport();
    s().importText(JSON.stringify(doc));
    expect(s().importer).toBeUndefined();
    expect(s().current?.doc.id).toBe('novo');
    expect(s().notice).toMatchObject({ kind: 'warnings' });
  });

  it('A13: same id -> conflict; replace keeps positions and expansion', () => {
    const { s, storage } = setup();
    s().init();
    const saved = { ...exampleDoc(), layout: { positions: { apigee: { x: 10, y: 20 } } } };
    storage.setItem(systemKey(saved.id), JSON.stringify(saved));
    storage.setItem(uiKey(saved.id), JSON.stringify({ expandedIds: ['rabbitmq'] }));

    s().openImport();
    s().importText(toExportJson(exampleDoc()));
    expect(s().importer).toMatchObject({ step: 'conflict', existingName: saved.name });

    s().resolveConflict('replace');
    expect(s().importer).toBeUndefined();
    expect(s().current?.doc.layout?.positions).toEqual({ apigee: { x: 10, y: 20 } });
    expect([...(s().current?.expanded ?? [])]).toEqual(['rabbitmq']);
  });

  it('A13: import as copy creates exemplo-pedidos-copia', () => {
    const { s } = setup();
    s().init();
    s().openImport();
    s().importText(toExportJson(exampleDoc()));
    s().resolveConflict('copy');
    expect(s().current?.doc.id).toBe('exemplo-pedidos-copia');
    expect(s().systems.map((e) => e.id)).toContain('exemplo-pedidos-copia');
  });

  it('A14: fenced JSON imports normally', () => {
    const { s } = setup();
    s().init();
    s().openImport();
    s().importText(
      'Aqui está:\n```json\n' + JSON.stringify({ ...exampleDoc(), id: 'cercado' }) + '\n```',
    );
    expect(s().current?.doc.id).toBe('cercado');
  });
});

describe('backup import (SPEC §6.2 step 6, A20)', () => {
  it('A20: restore with "Substituir todos" brings back the backup content', () => {
    const { s } = setup();
    s().init();
    const edited = { ...exampleDoc(), name: 'Editado' };
    const other = { ...exampleDoc(), id: 'outro', name: 'Outro' };
    s().openImport();
    s().importText(backupText(edited, other));
    expect(s().importer).toMatchObject({
      step: 'backupConflict',
      conflictIds: ['exemplo-pedidos'],
    });
    s().resolveBackupConflict('replace');
    expect(s().importer).toBeUndefined();
    expect(
      s()
        .systems.map((e) => e.id)
        .sort(),
    ).toEqual(['exemplo-pedidos', 'outro']);
    expect(s().current?.doc.name).toBe('Editado');
    expect(s().notice).toMatchObject({ kind: 'info' });
  });

  it('skip existing and import as copies', () => {
    const { s } = setup();
    s().init();
    s().openImport();
    s().importText(backupText(exampleDoc()));
    s().resolveBackupConflict('skip');
    expect(s().systems).toHaveLength(1);

    s().openImport();
    s().importText(backupText(exampleDoc()));
    s().resolveBackupConflict('copy');
    expect(s().systems.map((e) => e.id)).toContain('exemplo-pedidos-copia');
  });

  it('invalid systems are listed; the valid ones can be imported', () => {
    const { s } = setup();
    s().init();
    const bad = { ...exampleDoc(), id: 'ruim', edges: [{ id: 'x', source: 'a', target: 'b' }] };
    s().openImport();
    s().importText(backupText(bad, { ...exampleDoc(), id: 'bom' }));
    expect(s().importer).toMatchObject({ step: 'backupInvalid' });
    s().importValidBackupSystems();
    expect(s().systems.map((e) => e.id)).toContain('bom');
    expect(s().systems.map((e) => e.id)).not.toContain('ruim');
  });
});
