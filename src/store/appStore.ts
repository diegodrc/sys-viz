import { createStore, type StoreApi } from 'zustand/vanilla';
import example from '../examples/example-system-v2.json';
import { aggregateEdges } from '../graph/aggregate';
import {
  applySavedPositions,
  buildElkGraph,
  readElkLayout,
  settleDrag,
  type Boxes,
} from '../graph/layout';
import { EMPTY_FILTERS, type NodeFilters, type PlatformFilterValue } from '../graph/filter';
import { readElkRoutes, type EdgeRoutes } from '../graph/edgeRoute';
import { expandPath } from '../graph/flowPath';
import { buildLogicElkGraph, readLogicLayout } from '../graph/logicLayout';
import { positionsOf, resetPositions, setPositions } from '../graph/positions';
import { buildTree, type TreeIndex } from '../graph/tree';
import { expandAll, isVisible, pruneExpanded, visibleAncestor } from '../graph/visibility';
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
import { replaceEdge, replaceFlow, replaceNode, replaceSystemInfo } from '../schema/edit';
import { replaceGraphInfo, replaceStep } from '../schema/editLogic';
import { graphOf, handlerOf, type GraphRef } from '../schema/logic';
import type {
  Flow,
  LogicStep,
  NodeType,
  StepCategory,
  SysEdge,
  SysNode,
  SystemDoc,
} from '../schema/system';
import { validateSystemDoc } from '../schema/validate';
import { logicErrors } from '../schema/validateLogic';
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
  type Theme,
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

/**
 * What the details panel shows (SPEC §6.6): a node, a rendered (possibly aggregated) edge, an
 * original document edge, a flow, or the system itself.
 */
export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'docEdge'; id: string }
  | { kind: 'flow'; id: string }
  | { kind: 'system' };

/** One level of the logic drill-down trail (SPEC §18.7). */
export type LogicLevel =
  | { kind: 'handler'; edgeId: string }
  | { kind: 'subprocess'; id: string; fromStepId: string | undefined };

/** What the details panel shows in the logic view: a step, or the open handler/subprocess. */
export type LogicSelection = { kind: 'step'; id: string } | { kind: 'graph' };

export interface LogicView {
  /** Never empty while the logic view is open; the last level is the one shown. */
  trail: LogicLevel[];
  selection: LogicSelection | undefined;
  /** Category filter (SPEC §18.7); empty = no filter. Kept for the session. */
  categories: ReadonlySet<StepCategory>;
  /** Step to center and pulse (field search result, SPEC §18.9). */
  pulse: { stepId: string; token: number } | undefined;
}

export interface LogicCanvasLayout {
  /** "<doc id>|<level>": the layout belongs to this graph. */
  key: string;
  boxes: Boxes;
  routes: EdgeRoutes;
  revision: number;
}

export function levelRef(level: LogicLevel): GraphRef {
  return level.kind === 'handler'
    ? { kind: 'handler', edgeId: level.edgeId }
    : { kind: 'subprocess', id: level.id };
}

export function logicLayoutKey(docId: string, level: LogicLevel): string {
  return level.kind === 'handler'
    ? docId + '|handler:' + level.edgeId
    : docId + '|subprocess:' + level.id;
}

export interface CanvasLayout {
  docId: string;
  /** Node boxes relative to their parent, after saved positions were applied. */
  boxes: Boxes;
  /** ELK edge routes (absolute); an edge whose ends moved is drawn without its route. */
  routes: EdgeRoutes;
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
  /** Secondary dialogs: "Gerar com IA" (SPEC §9.1) and "Sobre/Ajuda" (SPEC §2.1). */
  dialog: AppDialog | undefined;
  layout: CanvasLayout | undefined;
  /** True while an ELK request for the current state is running. */
  layoutPending: boolean;
  selection: Selection | undefined;
  /** Selected flow (SPEC §6.5); `step` is the 0-based index in step-by-step mode, if started. */
  activeFlow: ActiveFlow | undefined;
  /** Type/hosting filters (SPEC §6.4); kept for the session, not persisted. */
  filters: NodeFilters;
  /** Node to center and pulse after a search (SPEC §6.4); a new token re-triggers the effect. */
  pulse: { id: string; token: number } | undefined;
  /** Original edge to center and pulse after "ver no mapa" from a logic step (SPEC §18.7). */
  edgePulse: { id: string; token: number } | undefined;
  /** Logic drill-down (SPEC §18.7); undefined while the map is shown. */
  logic: LogicView | undefined;
  logicLayout: LogicCanvasLayout | undefined;

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
  openDialog: (dialog: AppDialog) => void;
  closeDialog: () => void;
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

  /** "clicar navega": expands the node's ancestors if needed and selects it. */
  focusNode: (id: string) => void;
  // Edits (SPEC §6.6): validated drafts are applied, persisted and update `updatedAt`.
  updateNode: (node: SysNode) => boolean;
  updateEdge: (edge: SysEdge) => boolean;
  updateFlow: (flow: Flow) => boolean;
  updateSystemInfo: (info: { name: string; description: string | undefined }) => boolean;

  // Flows (SPEC §6.5)
  selectFlow: (id: string | undefined) => void;
  /** Minimal expansion so every flow edge has both ends visible; keeps the current state. */
  expandFlowPath: () => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  /** "Expandir" in the hidden-step hint: makes both ends of the current step visible. */
  revealCurrentStep: () => void;

  // Navigation (SPEC §6.4)
  toggleTypeFilter: (type: NodeType) => void;
  togglePlatformFilter: (platform: PlatformFilterValue) => void;
  clearFilters: () => void;
  /** Search result chosen: expand ancestors, select, center and pulse for 2 s. */
  focusSearchResult: (id: string) => void;
  setTheme: (theme: Theme) => void;

  // Business logic (SPEC §18.6–18.9)
  /** Opens the handler of an incoming edge; `append` adds it to the trail ("Seguir"). */
  openLogic: (edgeId: string, options?: { append?: boolean; stepId?: string }) => void;
  /** Opens a shared subprocess on its own (field search result inside a subprocess). */
  openSubprocess: (id: string, stepId?: string) => void;
  /** Opens the subprocess of a step of the current level as a new trail level. */
  openStepSubprocess: (stepId: string) => void;
  /** Opens the graph holding a step and selects/pulses the step. */
  openStep: (ref: GraphRef, stepId: string) => void;
  goToLogicLevel: (index: number) => void;
  /** Esc: one trail level up, or back to the map from the first level. */
  logicBack: () => void;
  closeLogic: () => void;
  selectLogic: (selection: LogicSelection | undefined) => void;
  toggleStepCategory: (category: StepCategory) => void;
  clearStepCategories: () => void;
  /** Back to the map with the edge's ends visible, the edge selected and pulsing. */
  showEdgeOnMap: (edgeId: string) => void;
  updateLogicStep: (ref: GraphRef, step: LogicStep) => boolean;
  updateGraphInfo: (
    ref: GraphRef,
    info: { name: string | undefined; description: string | undefined },
  ) => boolean;
}

/** User Timing name for each ELK run, to check the SPEC §11 target (≤ 1 s for 300 nodes). */
export const LAYOUT_MEASURE = 'sysviz:layout';

/** Duration of the search-result pulse (SPEC §6.4). */
export const PULSE_MS = 2000;

export type AppDialog = 'ai' | 'about';

export type AppStore = StoreApi<AppState>;

export interface ActiveFlow {
  id: string;
  step: number | undefined;
}

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
      // local User Timing entry (DevTools / performance.getEntriesByName), never sent anywhere
      const started = performance.now();
      deps.layout(graph).then(
        (result) => {
          performance.measure(LAYOUT_MEASURE, { start: started, end: performance.now() });
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
            layout: {
              docId: doc.id,
              boxes,
              routes: readElkRoutes(result),
              revision: (state.layout?.revision ?? 0) + 1,
            },
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
    /** Applies an edit to the open document and persists it (memory updated only on success). */
    const applyEdit = (edit: (doc: SystemDoc) => SystemDoc): boolean => {
      const current = get().current;
      if (!current) return false;
      const doc = edit(current.doc);
      if (!persistDoc(doc, false)) return false;
      set({ current: { ...current, doc } });
      return true;
    };

    const edgeMap = (doc: SystemDoc): Map<string, SysEdge> =>
      new Map(doc.edges.map((e) => [e.id, e]));
    const flowById = (id: string): Flow | undefined =>
      get().current?.doc.flows?.find((f) => f.id === id);
    const currentFlow = (): Flow | undefined => {
      const id = get().activeFlow?.id;
      return id === undefined ? undefined : flowById(id);
    };

    let logicToken = 0;

    /** Runs ELK for the graph of the current logic level; stale results are discarded. */
    const requestLogicLayout = (): void => {
      const current = get().current;
      const level = get().logic?.trail.at(-1);
      if (!current || !level) return;
      const graph = graphOf(current.doc, levelRef(level));
      if (!graph) return;
      const key = logicLayoutKey(current.doc.id, level);
      const token = ++logicToken;
      deps.layout(buildLogicElkGraph(graph)).then(
        (result) => {
          if (token !== logicToken) return;
          const { boxes, routes } = readLogicLayout(result);
          set((state) => ({
            logicLayout: { key, boxes, routes, revision: (state.logicLayout?.revision ?? 0) + 1 },
          }));
        },
        () => {
          if (token !== logicToken) return;
          set({ notice: { kind: 'error', message: t.canvas.layoutFailed } });
        },
      );
    };

    /** Shows a trail (replacing the current one) with an optional selected, pulsing step. */
    const showLogic = (trail: LogicLevel[], focus: LogicSelection | undefined): void => {
      const previous = get().logic;
      const pulse =
        focus?.kind === 'step'
          ? { stepId: focus.id, token: (previous?.pulse?.token ?? 0) + 1 }
          : undefined;
      set({
        logic: {
          trail,
          selection: focus,
          categories: previous?.categories ?? new Set(),
          pulse,
        },
        selection: undefined,
      });
      if (pulse) {
        setTimeout(() => {
          const logic = get().logic;
          if (logic?.pulse?.token === pulse.token) set({ logic: { ...logic, pulse: undefined } });
        }, PULSE_MS);
      }
      requestLogicLayout();
    };

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

    /**
     * Opens a document. Without saved expansion it opens fully expanded (DECISIONS 2026-11-25,
     * replaces the SPEC §5.6 macro default); saved expansion is restored as before.
     */
    const showDoc = (doc: SystemDoc, expandedIds: Iterable<string> | undefined): void => {
      const tree = buildTree(doc);
      const expanded =
        expandedIds === undefined ? expandAll(tree) : pruneExpanded(tree, expandedIds);
      set({
        current: { doc, expanded },
        selection: undefined,
        activeFlow: undefined,
        logic: undefined,
        logicLayout: undefined,
      });
      setPrefs({ lastOpenedId: doc.id });
      requestLayout();
    };

    /** Saves a newly imported/created doc and opens it. */
    const addAndOpen = (doc: SystemDoc, expandedIds?: Iterable<string>): boolean => {
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
      dialog: undefined,
      layout: undefined,
      layoutPending: false,
      selection: undefined,
      activeFlow: undefined,
      filters: EMPTY_FILTERS,
      pulse: undefined,
      edgePulse: undefined,
      logic: undefined,
      logicLayout: undefined,

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
        showDoc(loaded.doc, loadUiState(storage, id)?.expandedIds);
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
        set({ current: undefined, logic: undefined, logicLayout: undefined });
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
        set({ importer: { step: 'input' }, dialog: undefined });
      },

      openDialog(dialog) {
        set({ dialog });
      },

      closeDialog() {
        set({ dialog: undefined });
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
        const expandedIds = loadUiState(storage, doc.id)?.expandedIds;
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

      focusNode(id) {
        const current = get().current;
        if (!current) return;
        const tree = buildTree(current.doc);
        if (!tree.byId.has(id)) return;
        const ancestors = tree.ancestorsOf(id);
        if (ancestors.some((a) => !current.expanded.has(a))) {
          applyExpansion([...current.expanded, ...ancestors]);
        }
        set({ selection: { kind: 'node', id } });
      },

      updateNode(node) {
        return applyEdit((doc) => replaceNode(doc, node));
      },

      updateEdge(edge) {
        return applyEdit((doc) => replaceEdge(doc, edge));
      },

      updateFlow(flow) {
        return applyEdit((doc) => replaceFlow(doc, flow));
      },

      selectFlow(id) {
        const flow = id === undefined ? undefined : flowById(id);
        set({ activeFlow: flow ? { id: flow.id, step: undefined } : undefined });
      },

      expandFlowPath() {
        const current = get().current;
        const flow = currentFlow();
        if (!current || !flow) return;
        const tree = buildTree(current.doc);
        const next = expandPath(flow, edgeMap(current.doc), tree, current.expanded);
        if (next.size !== current.expanded.size) applyExpansion(next);
      },

      goToStep(index) {
        const active = get().activeFlow;
        const flow = currentFlow();
        const step = flow?.steps[index];
        if (!active || !flow || !step) return;
        set({
          activeFlow: { ...active, step: index },
          selection: { kind: 'docEdge', id: step.edgeId },
        });
      },

      nextStep() {
        const active = get().activeFlow;
        const flow = currentFlow();
        if (!active || !flow) return;
        const next =
          active.step === undefined ? 0 : Math.min(active.step + 1, flow.steps.length - 1);
        get().goToStep(next);
      },

      previousStep() {
        const active = get().activeFlow;
        if (!active || active.step === undefined) return;
        get().goToStep(Math.max(active.step - 1, 0));
      },

      revealCurrentStep() {
        const current = get().current;
        const active = get().activeFlow;
        const step = active?.step === undefined ? undefined : currentFlow()?.steps[active.step];
        const edge = step && current ? edgeMap(current.doc).get(step.edgeId) : undefined;
        if (!current || !edge) return;
        const tree = buildTree(current.doc);
        applyExpansion([
          ...current.expanded,
          ...tree.ancestorsOf(edge.source),
          ...tree.ancestorsOf(edge.target),
        ]);
      },

      toggleTypeFilter(type) {
        const types = new Set(get().filters.types);
        if (types.has(type)) types.delete(type);
        else types.add(type);
        set({ filters: { ...get().filters, types } });
      },

      togglePlatformFilter(platform) {
        const platforms = new Set(get().filters.platforms);
        if (platforms.has(platform)) platforms.delete(platform);
        else platforms.add(platform);
        set({ filters: { ...get().filters, platforms } });
      },

      clearFilters() {
        set({ filters: EMPTY_FILTERS });
      },

      focusSearchResult(id) {
        // a component chosen while the logic view is open goes back to the map
        if (get().logic) get().closeLogic();
        get().focusNode(id);
        const token = (get().pulse?.token ?? 0) + 1;
        set({ pulse: { id, token } });
        // SPEC §6.4: the pulse lasts 2 s; clearing it lets the same node pulse again later
        setTimeout(() => {
          if (get().pulse?.token === token) set({ pulse: undefined });
        }, PULSE_MS);
      },

      setTheme(theme) {
        setPrefs({ theme });
      },

      updateSystemInfo(info) {
        return applyEdit((doc) => replaceSystemInfo(doc, info));
      },

      openLogic(edgeId, options = {}) {
        const current = get().current;
        if (!current || !handlerOf(current.doc, edgeId)) return;
        const level: LogicLevel = { kind: 'handler', edgeId };
        const previous = get().logic;
        const trail = options.append && previous ? [...previous.trail, level] : [level];
        showLogic(trail, options.stepId ? { kind: 'step', id: options.stepId } : undefined);
      },

      openSubprocess(id, stepId) {
        const current = get().current;
        if (!current || !graphOf(current.doc, { kind: 'subprocess', id })) return;
        showLogic(
          [{ kind: 'subprocess', id, fromStepId: undefined }],
          stepId ? { kind: 'step', id: stepId } : { kind: 'graph' },
        );
      },

      openStepSubprocess(stepId) {
        const current = get().current;
        const logic = get().logic;
        const level = logic?.trail.at(-1);
        if (!current || !logic || !level) return;
        const step = graphOf(current.doc, levelRef(level))?.steps.find((s) => s.id === stepId);
        const id = step?.subprocessId;
        if (id === undefined || !graphOf(current.doc, { kind: 'subprocess', id })) return;
        showLogic([...logic.trail, { kind: 'subprocess', id, fromStepId: stepId }], {
          kind: 'graph',
        });
      },

      openStep(ref, stepId) {
        if (ref.kind === 'handler') get().openLogic(ref.edgeId, { stepId });
        else get().openSubprocess(ref.id, stepId);
      },

      goToLogicLevel(index) {
        const logic = get().logic;
        if (!logic || index < 0 || index >= logic.trail.length) return;
        set({ logic: { ...logic, trail: logic.trail.slice(0, index + 1), selection: undefined } });
        requestLogicLayout();
      },

      logicBack() {
        const logic = get().logic;
        if (!logic) return;
        if (logic.trail.length > 1) get().goToLogicLevel(logic.trail.length - 2);
        else get().closeLogic();
      },

      closeLogic() {
        logicToken++;
        set({ logic: undefined, logicLayout: undefined });
      },

      selectLogic(selection) {
        const logic = get().logic;
        if (logic) set({ logic: { ...logic, selection } });
      },

      toggleStepCategory(category) {
        const logic = get().logic;
        if (!logic) return;
        const categories = new Set(logic.categories);
        if (categories.has(category)) categories.delete(category);
        else categories.add(category);
        set({ logic: { ...logic, categories } });
      },

      clearStepCategories() {
        const logic = get().logic;
        if (logic) set({ logic: { ...logic, categories: new Set() } });
      },

      showEdgeOnMap(edgeId) {
        const current = get().current;
        const edge = current && edgeMap(current.doc).get(edgeId);
        if (!current || !edge) return;
        get().closeLogic();
        const tree = buildTree(current.doc);
        const ancestors = [...tree.ancestorsOf(edge.source), ...tree.ancestorsOf(edge.target)];
        if (ancestors.some((a) => !current.expanded.has(a))) {
          applyExpansion([...current.expanded, ...ancestors]);
        }
        const token = (get().edgePulse?.token ?? 0) + 1;
        set({ selection: { kind: 'docEdge', id: edgeId }, edgePulse: { id: edgeId, token } });
        setTimeout(() => {
          if (get().edgePulse?.token === token) set({ edgePulse: undefined });
        }, PULSE_MS);
      },

      updateLogicStep(ref, step) {
        const current = get().current;
        if (!current) return false;
        const doc = replaceStep(current.doc, ref, step);
        // a category change can break a rule of SPEC §18.5 (e.g. the only "start")
        const [problem] = logicErrors(doc);
        if (problem) {
          set({ notice: { kind: 'error', message: t.logic.edit.invalidLogic(problem.message) } });
          return false;
        }
        return applyEdit(() => doc);
      },

      updateGraphInfo(ref, info) {
        return applyEdit((doc) => replaceGraphInfo(doc, ref, info));
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
