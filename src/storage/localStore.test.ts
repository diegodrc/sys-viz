import { describe, expect, it } from 'vitest';
import { exampleDoc } from '../test/fixtures';
import { testStorage } from '../test/storage';
import {
  DEFAULT_PREFS,
  INDEX_KEY,
  deleteSystem,
  emptyIndex,
  hasAnyAppKey,
  indexEntryFor,
  loadPrefs,
  loadStartupState,
  loadSystem,
  loadUiState,
  saveSystem,
  saveUiState,
  systemKey,
  uiKey,
  type SystemIndex,
} from './localStore';

const NOW = '2026-11-24T12:00:00.000Z';

function indexWith(...ids: string[]): SystemIndex {
  return {
    version: 1,
    systems: ids.map((id) => ({ id, name: id, nodeCount: 1, updatedAt: NOW, openedAt: NOW })),
  };
}

describe('localStore (SPEC §7)', () => {
  it('detects whether any sysviz: key exists', () => {
    expect(hasAnyAppKey(testStorage({ other: '1' }))).toBe(false);
    expect(hasAnyAppKey(testStorage({ 'sysviz:prefs': '{}' }))).toBe(true);
  });

  it('saves a system then the index, and loads it back', () => {
    const storage = testStorage();
    const doc = exampleDoc();
    const index: SystemIndex = { version: 1, systems: [indexEntryFor(doc, NOW, NOW)] };
    expect(saveSystem(storage, doc, index).ok).toBe(true);
    expect(index.systems[0]?.nodeCount).toBe(27);
    const loaded = loadSystem(storage, doc.id);
    expect(loaded.ok && loaded.doc).toEqual(doc);
    expect(loadStartupState(storage, NOW)).toEqual({ index, corrupted: [] });
  });

  it('a corrupted entry does not throw and is reported with its raw content', () => {
    const storage = testStorage({
      [INDEX_KEY]: JSON.stringify(indexWith('bad', 'broken')),
      [systemKey('bad')]: '{ not json',
      [systemKey('broken')]: JSON.stringify({ schemaVersion: 1, id: 'broken' }),
    });
    const state = loadStartupState(storage, NOW);
    expect(state.index.systems).toEqual([]);
    expect(state.corrupted).toEqual([
      { id: 'bad', raw: '{ not json' },
      { id: 'broken', raw: '{"schemaVersion":1,"id":"broken"}' },
    ]);
    expect(loadSystem(storage, 'bad').ok).toBe(false);
  });

  it('a corrupted index is rebuilt from the stored systems', () => {
    const doc = exampleDoc();
    const storage = testStorage({
      [INDEX_KEY]: 'garbage',
      [systemKey(doc.id)]: JSON.stringify(doc),
    });
    const state = loadStartupState(storage, NOW);
    expect(state.index.systems.map((s) => s.id)).toEqual([doc.id]);
  });

  it('repairs the index: drops entries without system, re-adds valid orphans', () => {
    const doc = exampleDoc();
    const storage = testStorage({
      [INDEX_KEY]: JSON.stringify(indexWith('ghost')),
      [systemKey(doc.id)]: JSON.stringify(doc),
    });
    const state = loadStartupState(storage, NOW);
    expect(state.index.systems).toEqual([
      { id: doc.id, name: doc.name, nodeCount: 27, updatedAt: NOW, openedAt: '' },
    ]);
    // the repaired index is persisted
    expect(JSON.parse(storage.dump()[INDEX_KEY] ?? '{}')).toEqual(state.index);
  });

  it('QuotaExceededError on the system write is returned, previous state intact', () => {
    const doc = exampleDoc();
    const index = { version: 1 as const, systems: [indexEntryFor(doc, NOW, NOW)] };
    const storage = testStorage();
    saveSystem(storage, doc, index);
    const before = storage.dump();

    storage.failWritesTo((key) => key === systemKey(doc.id));
    const result = saveSystem(storage, { ...doc, name: 'Novo nome' }, index);
    expect(result).toEqual({ ok: false, errors: [{ kind: 'quota' }] });
    expect(storage.dump()).toEqual(before);
  });

  it('if the index write fails, the previous system value is restored', () => {
    const doc = exampleDoc();
    const index = { version: 1 as const, systems: [indexEntryFor(doc, NOW, NOW)] };
    const storage = testStorage();
    saveSystem(storage, doc, index);
    const before = storage.dump();

    storage.failWritesTo((key) => key === INDEX_KEY);
    expect(saveSystem(storage, { ...doc, name: 'Outro' }, index).ok).toBe(false);
    expect(storage.dump()).toEqual(before);
  });

  it('if the index write fails for a new system, the system key is removed', () => {
    const storage = testStorage();
    storage.failWritesTo((key) => key === INDEX_KEY);
    const doc = exampleDoc();
    expect(saveSystem(storage, doc, emptyIndex()).ok).toBe(false);
    expect(storage.dump()).toEqual({});
  });

  it('delete removes the system, its UI state and the index entry', () => {
    const doc = exampleDoc();
    const storage = testStorage();
    saveSystem(storage, doc, { version: 1, systems: [indexEntryFor(doc, NOW, NOW)] });
    saveUiState(storage, doc.id, { expandedIds: ['rabbitmq'] });
    expect(deleteSystem(storage, doc.id, emptyIndex()).ok).toBe(true);
    expect(storage.dump()).toEqual({ [INDEX_KEY]: JSON.stringify(emptyIndex()) });
  });

  it('UI state and prefs fall back to defaults when missing or invalid', () => {
    const storage = testStorage({ [uiKey('x')]: '[]', 'sysviz:prefs': '{"theme":"neon"}' });
    expect(loadUiState(storage, 'x')).toEqual({ expandedIds: [] });
    expect(loadPrefs(storage)).toEqual(DEFAULT_PREFS);
  });

  it('a storage whose getters throw behaves as empty', () => {
    const hostile = {
      get length(): number {
        throw new Error('blocked');
      },
      key: () => {
        throw new Error('blocked');
      },
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(hasAnyAppKey(hostile)).toBe(false);
    expect(loadStartupState(hostile, NOW)).toEqual({ index: emptyIndex(), corrupted: [] });
    expect(saveUiState(hostile, 'x', { expandedIds: [] })).toEqual({
      ok: false,
      errors: [{ kind: 'unknown', detail: 'blocked' }],
    });
  });
});
