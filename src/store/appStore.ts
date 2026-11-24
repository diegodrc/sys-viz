import { createStore, type StoreApi } from 'zustand/vanilla';
import example from '../examples/example-system.json';
import { aggregateEdges } from '../graph/aggregate';
import {
  applySavedPositions,
  buildElkGraph,
  readElkLayout,
  settleDrag,
  type Boxes,
} from '../graph/layout';
import { positionsOf, resetPositions, setPositions } from '../graph/positions';
import { buildTree, type TreeIndex } from '../graph/tree';
import { isVisible, pruneExpanded, visibleAncestor } from '../graph/visibility';
import { t } from '../i18n/pt-BR';
import type { LayoutEngine } from '../layout/engine';
import {
  asCopy,
  asReplacement,
  parseImport,
  planBackupImport,
  type BackupConflictStrategy,
} from '../import/importSystem';
import type { Issue } from '../schema/result';
import type { SystemDoc } from '../schema/system';
import { validateSystemDoc } from '../schema/validate';
import type { InvalidBackupEntry } from '../storage/backup';
import {
  DEFAULT_PREFS,
  deleteSystem as deleteStoredSystem,
  hasAnyAppKey,
  indexEntryFor,
  loadPrefs,
  loadStartupState,
  loadSystem,
  loadUiState,
  readRawSystem,
  saveIndex,
  savePrefs,
  saveSystem,
  saveUiState,
  type CorruptEntry,
  type IndexEntry,
  type Prefs,
  type StorageFailure,
  type StorageLike,
} from '../storage/localStore';

// Application state and actions (SPEC §6.1–6.3, §7). Components only read state and call these
// actions; all business rules live here or in the pure modules it calls.

export interface AppDeps {
  storage: StorageLike;
  /** False when localStorage is unavailable and an in-memory fallback is used. */
  persistent: boolean;
  now: () => Date;
  /** Runs ELK (Web Worker in the browser, direct call in tests). */
  layout: LayoutEngine;
}

export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string };

export interface CanvasLayout {
  docId: string;
  /** Node boxes relative to their parent, after saved positions were applied. */
  boxes: Boxes;
  /** Incremented on every ELK result (the canvas fits the view when it changes). */
  revision: number;
}

export type Notice =
  | { kind: 'error'; message: string }
  | { kind: 'info'; message: string }
  | { kind: 'warnings'; message: string; details: Issue[] };

export type ImportStep =
  | { step: 'input' }
  | { step: 'errors'; errors: Issue[] }
  | { step: 'conflict'; doc: SystemDoc; warnings: Issue[]; existingName: string }
  | { step: 'backupInvalid'; valid: SystemDoc[]; invalid: InvalidBackupEntry[]; warnings: Issue[] }
  | { step: 'backupConflict'; docs: SystemDoc[]; conflictIds: string[]; warnings: Issue[] };

export interface CurrentSystem {
  doc: SystemDoc;
  expanded: ReadonlySet<string>;
}

export interface AppState {
  ready: boolean;
  persistent: boolean;
  /** Saved systems, most recently opened first (SPEC §6.1). */
  systems: IndexEntry[];
  corrupted: CorruptEntry[];
  current: CurrentSystem | undefined;
  prefs: Prefs;
  notice: Notice | undefined;
  /** Import dialog state; undefined when the dialog is closed. */
  importer: ImportStep | undefined;
  layout: CanvasLayout | undefined;
  /** True while an ELK request for the current state is running. */
  layoutPending: boolean;
  selection: Selection | undefined;

  init: () => void;
  loadExample: () => void;
  openSystem: (id: string) => void;
  /** Leaves the open system and shows the list (Error Boundary "Voltar à lista"). */
  closeSystem: () => void;
  renameSystem: (id: string, name: string) => boolean;
  duplicateSystem: (id: string) => void;
  deleteSystem: (id: string) => void;
  removeCorrupted: (id: string) => void;
  rawSystemText: (id: string) => string | null;
  exportableSystem: (id: string) => SystemDoc | undefined;
  exportableSystems: () => SystemDoc[];
  setSidebarOpen: (open: boolean) => void;
  dismissNotice: () => void;

  openImport: () => void;
  closeImport: () => void;
  importText: (text: string) => void;
  resolveConflict: (choice: 'replace' | 'copy') => void;
  importValidBackupSystems: () => void;
  resolveBackupConflict: (strategy: BackupConflictStrategy) => void;

  /** Expands a collapsed group or collapses an expanded one (SPEC §5.2). */
  toggleExpanded: (id: string) => void;
  /** Replaces the expansion state (levels, "Expandir caminho"...). */
  setExpanded: (ids: Iterable<string>) => void;
  select: (selection: Selection | undefined) => void;
  /** Drop of a dragged node at a position relative to its parent (SPEC §5.5). */
  dropNode: (id: string, position: { x: number; y: number }) => void;
  /** "Resetar layout": clears saved positions and re-runs ELK. */
  resetLayout: () => void;
}

export type AppStore = StoreApi<AppState>;

function sortByOpened(entries: readonly IndexEntry[]): IndexEntry[] {
  return [...entries].sort(
    (a, b) => b.openedAt.localeCompare(a.openedAt) || a.name.localeCompare(b.name, 'pt-BR'),
  );
}

function failureMessage(errors: readonly StorageFailure[]): string {
  const first = errors[0];
  if (!first || first.kind === 'quota') return t.storage.quota;
  if (first.kind === 'unavailable') return t.storage.unavailable;
  return t.storage.writeFailed(first.detail);
}

function warningsNotice(warnings: readonly Issue[], fallback?: string): Notice | undefined {
  if (warnings.length > 0) {
    return {
      kind: 'warnings',
      message: t.importer.warningsTitle(warnings.length),
      details: [...warnings],
    };
  }
  return fallback ? { kind: 'info', message: fallback } : undefined;
}

export function createAppStore(deps: AppDeps): AppStore {
  const { storage } = deps;
  const nowIso = (): string => deps.now().toISOString();

  return createStore<AppState>()((set, get) => {
    /** Writes a document and its index entry; updates memory only after storage succeeds. */
    const persistDoc = (doc: SystemDoc, opened: boolean): boolean => {
      const now = nowIso();
      const previous = get().systems.find((e) => e.id === doc.id);
      const entry = indexEntryFor(doc, now, opened ? now : (previous?.openedAt ?? now));
      const systems = [...get().systems.filter((e) => e.id !== doc.id), entry];
      const result = saveSystem(storage, doc, { version: 1, systems });
      if (!result.ok) {
        set({ notice: { kind: 'error', message: failureMessage(result.errors) } });
        return false;
      }
      set({ systems: sortByOpened(systems) });
      return true;
    };

    const setPrefs = (patch: Partial<Prefs>): void => {
      const prefs = { ...get().prefs, ...patch };
      set({ prefs });
      savePrefs(storage, prefs);
    };

    let layoutToken = 0;

    /** Runs ELK for the current document and expansion; stale results are discarded. */
    const requestLayout = (): void => {
      const current = get().current;
      if (!current) return;
      const token = ++layoutToken;
      const { doc, expanded } = current;
      const tree = buildTree(doc);
      const graph = buildElkGraph(tree, expanded, aggregateEdges(doc, expanded, tree));
      set({ layoutPending: true });
      deps.layout(graph).then(
        (result) => {
          if (token !== layoutToken || get().current?.doc.id !== doc.id) return;
          // read positions from the latest doc: a drop may have happened meanwhile
          const latest = get().current?.doc ?? doc;
          const boxes = applySavedPositions(
            readElkLayout(result),
            positionsOf(latest),
            tree,
            expanded,
          );
          set((state) => ({
            layout: { docId: doc.id, boxes, revision: (state.layout?.revision ?? 0) + 1 },
            layoutPending: false,
          }));
        },
        () => {
          if (token !== layoutToken) return;
          set({ layoutPending: false, notice: { kind: 'error', message: t.canvas.layoutFailed } });
        },
      );
    };

    /** SPEC §6.4: if the selected node became hidden, select its deepest visible ancestor. */
    const fixSelection = (tree: TreeIndex, expanded: ReadonlySet<string>): void => {
      const selection = get().selection;
      if (selection?.kind === 'node' && !isVisible(selection.id, tree, expanded)) {
        set({ selection: { kind: 'node', id: visibleAncestor(selection.id, tree, expanded) } });
      } else if (selection?.kind === 'edge') {
        set({ selection: undefined });
      }
    };

    const applyExpansion = (ids: Iterable<string>): void => {
      const current = get().current;
      if (!current) return;
      const tree = buildTree(current.doc);
      const expanded = pruneExpanded(tree, ids);
      set({ current: { ...current, expanded } });
      saveUiState(storage, current.doc.id, { expandedIds: [...expanded] });
      fixSelection(tree, expanded);
      requestLayout();
    };

    const showDoc = (doc: SystemDoc, expandedIds: Iterable<string>): void => {
      const expanded = pruneExpanded(buildTree(doc), expandedIds);
      set({ current: { doc, expanded }, selection: undefined });
      setPrefs({ lastOpenedId: doc.id });
      requestLayout();
    };

    /** Saves a newly imported/created doc and opens it. */
    const addAndOpen = (doc: SystemDoc, expandedIds: Iterable<string> = []): boolean => {
      if (!persistDoc(doc, true)) return false;
      showDoc(doc, expandedIds);
      return true;
    };

    const takenIds = (): Set<string> =>
      new Set([...get().systems.map((e) => e.id), ...get().corrupted.map((c) => c.id)]);

    const markCorrupted = (id: string, raw: string | null): void => {
      set((state) => ({
        corrupted: [...state.corrupted.filter((c) => c.id !== id), { id, raw: raw ?? '' }],
        systems: state.systems.filter((e) => e.id !== id),
        current: state.current?.doc.id === id ? undefined : state.current,
        notice: { kind: 'error', message: t.storage.openFailed(id) },
      }));
    };

    /** Routes a validated system through the new-id / conflict decision (SPEC §6.2 steps 4–5). */
    const offerSystem = (doc: SystemDoc, warnings: Issue[]): void => {
      const existing = get().systems.find((e) => e.id === doc.id);
      if (existing) {
        set({ importer: { step: 'conflict', doc, warnings, existingName: existing.name } });
        return;
      }
      if (addAndOpen(doc)) {
        set({ importer: undefined, notice: warningsNotice(warnings) });
      }
    };

    const applyBackup = (
      docs: readonly SystemDoc[],
      strategy: BackupConflictStrategy,
      warnings: Issue[],
    ): void => {
      const existing = new Map<string, SystemDoc | undefined>();
      for (const entry of get().systems) {
        const loaded = loadSystem(storage, entry.id);
        existing.set(entry.id, loaded.ok ? loaded.doc : undefined);
      }
      const plan = planBackupImport(docs, existing, strategy);
      let imported = 0;
      for (const item of plan) {
        if (!persistDoc(item.doc, false)) break;
        imported++;
      }
      set({ importer: undefined });
      if (imported < plan.length) return; // the storage error notice is already shown

      const current = get().current;
      const replacedCurrent = plan.find((p) => p.replaces && p.doc.id === current?.doc.id);
      if (current && replacedCurrent) {
        showDoc(replacedCurrent.doc, current.expanded);
      } else if (!current && plan[0]) {
        get().openSystem(plan[0].doc.id);
      }
      set({ notice: warningsNotice(warnings, t.importer.backupImported(imported)) });
    };

    /** Backup systems that passed validation: ask about conflicts, or import directly. */
    const offerBackupSystems = (docs: SystemDoc[], warnings: Issue[]): void => {
      const ids = new Set(get().systems.map((e) => e.id));
      const conflictIds = docs.filter((d) => ids.has(d.id)).map((d) => d.id);
      if (conflictIds.length > 0) {
        set({ importer: { step: 'backupConflict', docs, conflictIds, warnings } });
      } else {
        applyBackup(docs, 'skip', warnings);
      }
    };

    return {
      ready: false,
      persistent: deps.persistent,
      systems: [],
      corrupted: [],
      current: undefined,
      prefs: DEFAULT_PREFS,
      notice: deps.persistent ? undefined : { kind: 'error', message: t.storage.unavailable },
      importer: undefined,
      layout: undefined,
      layoutPending: false,
      selection: undefined,

      init() {
        const firstRun = !hasAnyAppKey(storage);
        set({ prefs: loadPrefs(storage) });
        if (firstRun) {
          // SPEC §6.1: first run loads and opens the example system
          get().loadExample();
          set({ ready: true });
          return;
        }
        const startup = loadStartupState(storage, nowIso());
        set({ systems: sortByOpened(startup.index.systems), corrupted: startup.corrupted });
        const last = get().prefs.lastOpenedId;
        if (last && startup.index.systems.some((e) => e.id === last)) get().openSystem(last);
        set({ ready: true });
      },

      loadExample() {
        const result = validateSystemDoc(structuredClone(example));
        if (!result.ok) return; // the bundled example is covered by tests
        offerSystem(result.value, result.warnings);
      },

      openSystem(id) {
        const loaded = loadSystem(storage, id);
        if (!loaded.ok) {
          markCorrupted(id, loaded.raw);
          return;
        }
        const now = nowIso();
        const systems = get().systems.map((e) => (e.id === id ? { ...e, openedAt: now } : e));
        saveIndex(storage, { version: 1, systems });
        set({ systems: sortByOpened(systems) });
        showDoc(loaded.doc, loadUiState(storage, id).expandedIds);
      },

      renameSystem(id, name) {
        const trimmed = name.trim();
        if (!trimmed) return false;
        const current = get().current;
        const loaded =
          current?.doc.id === id
            ? { ok: true as const, doc: current.doc }
            : loadSystem(storage, id);
        if (!loaded.ok) {
          markCorrupted(id, loaded.raw);
          return false;
        }
        const doc = { ...loaded.doc, name: trimmed };
        if (!persistDoc(doc, false)) return false;
        if (current?.doc.id === id) set({ current: { ...current, doc } });
        return true;
      },

      duplicateSystem(id) {
        const loaded = loadSystem(storage, id);
        if (!loaded.ok) {
          markCorrupted(id, loaded.raw);
          return;
        }
        // SPEC §6.1: expansion state is not copied
        persistDoc(asCopy(loaded.doc, takenIds()), false);
      },

      deleteSystem(id) {
        const systems = get().systems.filter((e) => e.id !== id);
        const result = deleteStoredSystem(storage, id, { version: 1, systems });
        if (!result.ok) {
          set({ notice: { kind: 'error', message: failureMessage(result.errors) } });
          return;
        }
        const current = get().current;
        set({ systems, current: current?.doc.id === id ? undefined : current });
        if (get().prefs.lastOpenedId === id) setPrefs({ lastOpenedId: undefined });
      },

      removeCorrupted(id) {
        const systems = get().systems.filter((e) => e.id !== id);
        deleteStoredSystem(storage, id, { version: 1, systems });
        set((state) => ({ corrupted: state.corrupted.filter((c) => c.id !== id), systems }));
      },

      rawSystemText(id) {
        return get().corrupted.find((c) => c.id === id)?.raw ?? readRawSystem(storage, id);
      },

      exportableSystem(id) {
        const current = get().current;
        if (current?.doc.id === id) return current.doc;
        const loaded = loadSystem(storage, id);
        return loaded.ok ? loaded.doc : undefined;
      },

      exportableSystems() {
        return get()
          .systems.map((e) => get().exportableSystem(e.id))
          .filter((doc): doc is SystemDoc => doc !== undefined);
      },

      closeSystem() {
        set({ current: undefined });
        setPrefs({ sidebarOpen: true, lastOpenedId: undefined });
      },

      setSidebarOpen(open) {
        setPrefs({ sidebarOpen: open });
      },

      dismissNotice() {
        set({
          notice: deps.persistent ? undefined : { kind: 'error', message: t.storage.unavailable },
        });
      },

      openImport() {
        set({ importer: { step: 'input' } });
      },

      closeImport() {
        set({ importer: undefined });
      },

      importText(text) {
        const parsed = parseImport(text);
        if (parsed.kind === 'errors') {
          set({ importer: { step: 'errors', errors: parsed.errors } });
        } else if (parsed.kind === 'system') {
          offerSystem(parsed.doc, parsed.warnings);
        } else {
          const valid = parsed.backup.valid.map((v) => v.doc);
          const warnings = parsed.backup.valid.flatMap((v) => v.warnings);
          if (parsed.backup.invalid.length > 0) {
            set({
              importer: { step: 'backupInvalid', valid, invalid: parsed.backup.invalid, warnings },
            });
          } else {
            offerBackupSystems(valid, warnings);
          }
        }
      },

      resolveConflict(choice) {
        const importer = get().importer;
        if (importer?.step !== 'conflict') return;
        const { doc, warnings } = importer;
        if (choice === 'copy') {
          if (addAndOpen(asCopy(doc, takenIds()))) {
            set({ importer: undefined, notice: warningsNotice(warnings) });
          }
          return;
        }
        const previous = loadSystem(storage, doc.id);
        const replaced = asReplacement(previous.ok ? previous.doc : undefined, doc);
        // SPEC §6.2: keep expansion ids that still exist
        const expandedIds = loadUiState(storage, doc.id).expandedIds;
        if (addAndOpen(replaced, expandedIds)) {
          set({ importer: undefined, notice: warningsNotice(warnings) });
        }
      },

      importValidBackupSystems() {
        const importer = get().importer;
        if (importer?.step !== 'backupInvalid') return;
        if (importer.valid.length === 0) {
          set({ importer: undefined });
          return;
        }
        offerBackupSystems(importer.valid, importer.warnings);
      },

      resolveBackupConflict(strategy) {
        const importer = get().importer;
        if (importer?.step !== 'backupConflict') return;
        applyBackup(importer.docs, strategy, importer.warnings);
      },

      toggleExpanded(id) {
        const current = get().current;
        if (!current || !buildTree(current.doc).isGroup(id)) return;
        const next = new Set(current.expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        applyExpansion(next);
      },

      setExpanded(ids) {
        applyExpansion(ids);
      },

      select(selection) {
        set({ selection });
      },

      dropNode(id, position) {
        const current = get().current;
        const layout = get().layout;
        if (!current || layout?.docId !== current.doc.id) return;
        const tree = buildTree(current.doc);
        // whole pixels keep the exported JSON readable
        const rounded = { x: Math.round(position.x), y: Math.round(position.y) };
        const settled = settleDrag(layout.boxes, tree, positionsOf(current.doc), id, rounded);
        const doc = setPositions(current.doc, settled.updates);
        if (!persistDoc(doc, false)) {
          // storage failed: re-emit the previous boxes so the node snaps back
          set({ layout: { ...layout, boxes: { ...layout.boxes } } });
          return;
        }
        set({ current: { ...current, doc }, layout: { ...layout, boxes: settled.boxes } });
      },

      resetLayout() {
        const current = get().current;
        if (!current) return;
        const doc = resetPositions(current.doc);
        if (!persistDoc(doc, false)) return;
        set({ current: { ...current, doc } });
        requestLayout();
      },
    };
  });
}
