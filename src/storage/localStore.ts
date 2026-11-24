import { z } from 'zod';
import { buildTree } from '../graph/tree';
import { validateSystemText } from '../schema/validate';
import type { SystemDoc } from '../schema/system';

// The only module that touches localStorage (SPEC §7). Every access is wrapped in try/catch and
// failures are returned as values. The backing storage is injectable for tests.

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const KEY_PREFIX = 'sysviz:';
export const INDEX_KEY = `${KEY_PREFIX}index`;
export const PREFS_KEY = `${KEY_PREFIX}prefs`;
const SYSTEM_PREFIX = `${KEY_PREFIX}system:`;
const UI_PREFIX = `${KEY_PREFIX}ui:`;

export const systemKey = (id: string): string => `${SYSTEM_PREFIX}${id}`;
export const uiKey = (id: string): string => `${UI_PREFIX}${id}`;

// ---------------------------------------------------------------------------------------------
// Stored shapes

const IndexEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  nodeCount: z.number(),
  updatedAt: z.string(),
  openedAt: z.string(),
});
export type IndexEntry = z.infer<typeof IndexEntrySchema>;

const IndexSchema = z.object({ version: z.literal(1), systems: z.array(IndexEntrySchema) });
export type SystemIndex = z.infer<typeof IndexSchema>;

const UiStateSchema = z.object({ expandedIds: z.array(z.string()) });
export type UiState = z.infer<typeof UiStateSchema>;

export const ThemeSchema = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof ThemeSchema>;

const PrefsSchema = z.object({
  theme: ThemeSchema,
  sidebarOpen: z.boolean(),
  lastOpenedId: z.string().optional(),
});
export type Prefs = z.infer<typeof PrefsSchema>;

export const DEFAULT_PREFS: Prefs = { theme: 'system', sidebarOpen: true };

// ---------------------------------------------------------------------------------------------
// Failures

export type StorageFailure =
  { kind: 'quota' } | { kind: 'unavailable' } | { kind: 'unknown'; detail: string };

export type StorageResult<T> = { ok: true; value: T } | { ok: false; errors: StorageFailure[] };

function isQuotaError(cause: unknown): boolean {
  if (!(cause instanceof DOMException)) return false;
  return (
    cause.name === 'QuotaExceededError' ||
    cause.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    cause.code === 22 ||
    cause.code === 1014
  );
}

function failure(cause: unknown): StorageFailure {
  if (isQuotaError(cause)) return { kind: 'quota' };
  return { kind: 'unknown', detail: cause instanceof Error ? cause.message : String(cause) };
}

function fail<T>(cause: unknown): StorageResult<T> {
  return { ok: false, errors: [failure(cause)] };
}

// ---------------------------------------------------------------------------------------------
// Low-level safe accessors

function read(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage: StorageLike, key: string, value: string): StorageResult<void> {
  try {
    storage.setItem(key, value);
    return { ok: true, value: undefined };
  } catch (cause) {
    return fail(cause);
  }
}

function remove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // removing is best-effort; a failure leaves an entry that index repair will clean up
  }
}

function keys(storage: StorageLike): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null) out.push(key);
    }
  } catch {
    // unreadable storage behaves as empty
  }
  return out;
}

function readJson<T>(storage: StorageLike, key: string, schema: z.ZodType<T>): T | undefined {
  const raw = read(storage, key);
  if (raw === null) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Resolves the browser's localStorage, or undefined if it is blocked or missing. */
export function browserStorage(): StorageLike | undefined {
  try {
    const storage = globalThis.localStorage;
    // touching the storage can throw when site data is blocked
    void storage.length;
    return storage;
  } catch {
    return undefined;
  }
}

/** In-memory fallback so the app still runs when localStorage is unavailable. */
export function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Public API

export interface CorruptEntry {
  id: string;
  raw: string;
}

export interface StartupState {
  index: SystemIndex;
  corrupted: CorruptEntry[];
}

export function hasAnyAppKey(storage: StorageLike): boolean {
  return keys(storage).some((key) => key.startsWith(KEY_PREFIX));
}

export function emptyIndex(): SystemIndex {
  return { version: 1, systems: [] };
}

export function indexEntryFor(doc: SystemDoc, updatedAt: string, openedAt: string): IndexEntry {
  return {
    id: doc.id,
    name: doc.name,
    nodeCount: buildTree(doc).order.length,
    updatedAt,
    openedAt,
  };
}

export type LoadedSystem = { ok: true; doc: SystemDoc } | { ok: false; raw: string | null };

export function loadSystem(storage: StorageLike, id: string): LoadedSystem {
  const raw = read(storage, systemKey(id));
  if (raw === null) return { ok: false, raw: null };
  const result = validateSystemText(raw);
  if (!result.ok || result.value.id !== id) return { ok: false, raw };
  return { ok: true, doc: result.value };
}

/**
 * Loads the index and reconciles it with the stored systems (SPEC §7):
 * entries without a system are dropped; valid systems without an entry are re-added; invalid
 * systems are reported as corrupted (and left in storage until the user removes them).
 */
export function loadStartupState(storage: StorageLike, now: string): StartupState {
  const stored = readJson(storage, INDEX_KEY, IndexSchema) ?? emptyIndex();
  const systemIds = keys(storage)
    .filter((key) => key.startsWith(SYSTEM_PREFIX))
    .map((key) => key.slice(SYSTEM_PREFIX.length));

  const valid = new Map<string, SystemDoc>();
  const corrupted: CorruptEntry[] = [];
  for (const id of systemIds) {
    const loaded = loadSystem(storage, id);
    if (loaded.ok) valid.set(id, loaded.doc);
    else corrupted.push({ id, raw: loaded.raw ?? '' });
  }

  // keep stored entries (in stored order) whose system is valid, then re-add orphans
  const systems: IndexEntry[] = stored.systems.filter((entry) => valid.has(entry.id));
  const listed = new Set(systems.map((entry) => entry.id));
  for (const [id, doc] of valid) {
    if (!listed.has(id)) systems.push(indexEntryFor(doc, now, ''));
  }

  const index: SystemIndex = { version: 1, systems };
  const changed =
    systems.length !== stored.systems.length ||
    systems.some((entry, i) => entry !== stored.systems[i]);
  if (changed) write(storage, INDEX_KEY, JSON.stringify(index));
  return { index, corrupted };
}

/**
 * Persists a system and the index in the order required by SPEC §7: system first, then index;
 * if the index write fails the previous system value is restored (or removed if it was new).
 */
export function saveSystem(
  storage: StorageLike,
  doc: SystemDoc,
  index: SystemIndex,
): StorageResult<void> {
  const key = systemKey(doc.id);
  const previous = read(storage, key);
  const systemWrite = write(storage, key, JSON.stringify(doc));
  if (!systemWrite.ok) return systemWrite;
  const indexWrite = write(storage, INDEX_KEY, JSON.stringify(index));
  if (!indexWrite.ok) {
    if (previous === null) remove(storage, key);
    else write(storage, key, previous);
    return indexWrite;
  }
  return { ok: true, value: undefined };
}

export function saveIndex(storage: StorageLike, index: SystemIndex): StorageResult<void> {
  return write(storage, INDEX_KEY, JSON.stringify(index));
}

/** Removes a system, its UI state and its index entry (SPEC §6.1 "excluir"). */
export function deleteSystem(
  storage: StorageLike,
  id: string,
  index: SystemIndex,
): StorageResult<void> {
  const indexWrite = write(storage, INDEX_KEY, JSON.stringify(index));
  if (!indexWrite.ok) return indexWrite;
  remove(storage, systemKey(id));
  remove(storage, uiKey(id));
  return { ok: true, value: undefined };
}

export function loadUiState(storage: StorageLike, id: string): UiState {
  return readJson(storage, uiKey(id), UiStateSchema) ?? { expandedIds: [] };
}

export function saveUiState(storage: StorageLike, id: string, ui: UiState): StorageResult<void> {
  return write(storage, uiKey(id), JSON.stringify(ui));
}

export function loadPrefs(storage: StorageLike): Prefs {
  return readJson(storage, PREFS_KEY, PrefsSchema) ?? DEFAULT_PREFS;
}

export function savePrefs(storage: StorageLike, prefs: Prefs): StorageResult<void> {
  return write(storage, PREFS_KEY, JSON.stringify(prefs));
}

/** Raw stored text of a system, for "Baixar conteúdo bruto" on corrupted entries. */
export function readRawSystem(storage: StorageLike, id: string): string | null {
  return read(storage, systemKey(id));
}
