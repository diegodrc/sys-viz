# sys-viz — Implementation plan & task breakdown

## Context

Greenfield: only `SPEC.md` + `CLAUDE.md` exist (no code, no git). The spec is complete and
prescriptive (stack §2, schema §4, behavior §5–7, tests §12, acceptance A1–A21 §13, order §14).
This plan turns it into small, verifiable tasks. On approval, the content below is written to
**`tasks/plan.md`** (phases, dependency graph, tasks with acceptance/verification) and
**`tasks/todo.md`** (flat checkbox list) — plan mode only allows this file until then.

**Slicing rule.** §17 makes "follow §14 one step at a time" a hard rule, so **phases = §14
steps**. Inside each phase, tasks are vertical: each one ends with something runnable/testable
end-to-end (a passing test suite for a spec rule, or a visible UI behavior), never "all types
first, all tests later". Phases 1–3 are pure logic, so their "vertical slice" is rule → code →
§12 test → green gate. From phase 4 on, each task is a user-visible path (store action → storage
→ component → test).

**Gate after every task:** `npm test && npm run typecheck && npm run lint` green.
**Checkpoint after every phase:** gate + listed acceptance criteria + update "Estado atual" in
`CLAUDE.md` + `DECISIONS.md` entries + human review before next phase.

## Dependency graph

```
scaffold(1)
   └─ schema/ (Zod, validate, migrations, jsonSchema) + example(2)
        ├─ import/preprocess (2)
        └─ graph/tree ─┬─ visibility ─┬─ aggregate ──┐
                       │              └─ flowPath ───┤        (3)
                       └─ positions ─────────────────┤
                                                     │
   storage/ (localStore, backup) ── store (Zustand) ─┤        (4)
        └─ import/importSystem (conflicts, uses positions)
                                                     │
   theme/nodeTypes + i18n ── Canvas (nodes/edges) ── layout.ts + ELK worker (5)
                                 ├─ DetailsPanel (6)
                                 ├─ Flows UI (7)  ← flowPath
                                 └─ Search/Filters/Levels/Legend/Theme (8)
   prompts/ ← jsonSchema + example ── AiPromptDialog (9)
   PWA + single-file builds ── A1–A21 sweep (10)
```

Phases 6, 7, 8, 9 all depend only on 5 (and 9 only on 2+4); they could run in parallel but §17
mandates sequence, so they stay sequential.

---

## Phase 1 — Scaffold (§2, §2.1, §16)

**T1.1 Project skeleton + pinned deps.** `npm create vite` (react-ts), pick exact versions
compatible across Vite × vite-plugin-pwa × vite-plugin-singlefile (drop to previous Vite major
if needed), remove `^`, TS `strict` + `noUncheckedIndexedAccess`, folder tree from §8,
`git init` + `.gitignore` (remove if unwanted).

- AC: `npm run dev` serves a placeholder page; `npm run typecheck` passes.
- Verify: open dev server in browser pane; `DECISIONS.md` lists every pinned version + why.

**T1.2 Tailwind v4 + i18n seed.** `@tailwindcss/vite`, `src/index.css` with
`@import "tailwindcss"` + `@theme` tokens (light/dark), no config file; `src/i18n/pt-BR.ts` with
the placeholder text.

- AC: placeholder styled via Tailwind; no literal strings in JSX.

**T1.3 Lint/format.** `eslint.config.js` per §16 (type-checked TS, react-hooks, react-refresh,
`react/jsx-no-literals` noStrings+ignoreProps, prettier compat), `.prettierrc`, scripts
`lint` (`--max-warnings 0`) and `format`.

- AC: `npm run lint` passes; a temporary JSX literal makes it fail (then removed).

**T1.4 Vitest + setup.** jsdom env, `src/test/setup.ts` with `ResizeObserver`,
`DOMMatrixReadOnly`, `offsetWidth/Height` mocks; one smoke test (App renders).

- AC: `npm test` green.

**T1.5 Both build targets (empty app).** `build` → `dist/` with vite-plugin-pwa
(`autoUpdate`, manifest, 192/512 icons, `base: './'`); `build:single` → mode `single`,
singlefile plugin, no SW registration, Node post-step renaming to `dist-single/sys-viz.html`.

- AC: both commands succeed; `sys-viz.html` opens via `file://` with no network requests;
  `dist/` contains `sw.js` + manifest.

**Checkpoint 1:** gate green; both builds produce artifacts; human review of pinned versions.

## Phase 2 — Schema, validation, example (§4, §10, §12)

**T2.1 Zod schema + example.** `src/schema/system.ts` (`SysNodeSchema` recursive via getter,
edges, flows, layout, `SystemDocSchema`; no `.default()`, label max 40, id regex, name 1..80);
`src/examples/example-system.json` copied verbatim from §10.

- AC/test: example parses; enum/required/schemaVersion≠1 failures produce errors.

**T2.2 `validate.ts` — errors.** Pipeline: size (>5 MB) → JSON.parse (line/col) → depth
(>20, iterative, before Zod) → Zod → node count (>2000) → duplicates (node/edge/flow) → dangling
edge refs → ancestor/self edges → dangling flow steps → forbidden metadata keys. Result is
`{ok,value,warnings}|{ok:false,errors}` with `severity/path/message` (pt-BR, in i18n).

- Test: one test per error rule 1–9, incl. deep nesting with no stack overflow and `__proto__`.

**T2.3 `validate.ts` — warnings.** Disconnected consecutive steps, unknown position ids
(dropped), isolated root, unknown keys (collected by diffing raw vs parsed, with path).

- Test: one per warning; **example validates with 0 errors and 0 warnings**.

**T2.4 Migrations + jsonSchema.** `migrations.ts` map (v1 identity; >1 → "versão mais nova"
error); `jsonSchema.ts` with `z.toJSONSchema(SystemDocSchema)`.

- Test: future version error; JSON Schema generated and non-empty.

**T2.5 `import/preprocess.ts`.** Strip fences, first valid JSON block, `{…}` fallback, original
parse error on failure.

- Test: §12 preprocess cases + prose-wrapped JSON.

**Checkpoint 2:** gate green; all §12 `validate`/`preprocess`/`jsonSchema` tests present.

## Phase 3 — Graph logic (§3, §5.4, §6.5, §13 A2–A7)

**T3.1 `tree.ts` + `visibility.ts`.** TreeIndex (byId, parentOf, depth, ancestorsOf,
descendants, maxDepth); `visibleAncestor`, `visibleNodes(expanded)`, `expandToLevel(N)`.

- Test: A2/A3/A4 node counts (9 / 13 / 27).

**T3.2 `aggregate.ts`.** `aggregateEdges(doc, expandedIds): RenderedEdge[]` per §5.4 (internal
hidden, ×N, async/assumed only if all, opposite pairs distinct).

- Test: A2 (9 edges incl. two ×2), A3 (12 + the 5 named), A4 (21, none aggregated).

**T3.3 `flowPath.ts`.** `formatSteps`, `stepBadges(flow, rendered)`, `nodesOnPath`,
`expandPath(flow) → expandedIds`, `stepLocation` (hidden inside which collapsed node).

- Test: §12 badges `2, 3, 6,10, 8,12, 14`; expandPath = exactly the 4 ids; formatSteps cases.

**T3.4 `positions.ts`.** `mergePositionsOnReplace(old, incoming)`, group bounding box +
negative-offset compensation helper (§5.5 drag rule) as pure functions.

- Test: §12 positions cases; compensation keeps children's absolute positions.

**Checkpoint 3:** gate green; A2–A4, A6 badges, A7 expansion proven at logic level.

## Phase 4 — Storage, store, sidebar (§6.1–6.3, §7)

**T4.1 `storage/localStore.ts`.** Typed get/set/remove with try/catch, write order
system→index with rollback, quota error as value, corrupted entry detection, index repair on
start.

- Test: corrupted entry doesn't throw; quota handled and previous state intact; index repair.

**T4.2 Store + first run (A1).** Zustand `useAppStore` (systems index, current doc,
expandedIds, prefs); bootstrap: no `sysviz:` keys → load example; else open `lastOpenedId`.
Minimal shell layout (topbar/sidebar/canvas placeholder) from §5.1.

- AC: A1 in browser; Error Boundary with "Voltar à lista".

**T4.3 Sidebar list + manage.** List (name, node count, updatedAt, sorted by openedAt), open,
rename, duplicate (`-copia`, `-copia-2`, 80-char trimming), delete with confirm, corrupted
entry banner (download raw / remove), empty state, topbar system dropdown.

- Test: duplicate id/name generation; component test delete flow.

**T4.4 Import dialog (file/paste).** Preprocess → migrate → validate; errors list + "Copiar
erros para a IA" (clipboard with fallback); warnings toast; `importSystem.ts` conflict dialog
(Substituir w/ position merge + expansion keep / Cópia / Cancelar).

- Test: importSystem replace/copy; AC A12, A13 (logic), A14.

**T4.5 Export + backup.** Export `<id>.json` (2-space), backup `sysviz-backup-AAAA-MM-DD.json`,
backup import with per-system validation and bulk conflict dialog.

- AC: A20 manually; test backup round-trip.

**Checkpoint 4:** gate; A1, A12, A14, A20 verified in browser.

## Phase 5 — Canvas (§5.2, §5.3, §5.5, §5.6)

**T5.1 Node/edge rendering (no ELK yet).** `theme/nodeTypes.ts`, `SysNodeCard`, `GroupNode`,
`SysEdge` (sync/async/assumed/×N, smoothstep, handles R→L, "+N", hosting badge, dashed assumed
border + tooltip), React Flow with derived nodes from visibility+aggregate, temporary grid
positions.

- Component test: example macro view → 9 nodes / 9 edges passed to `<ReactFlow>`. AC A5.

**T5.2 ELK layout in worker.** `graph/layout.ts` (build ELK graph from visible nodes + rendered
edges, edges in LCA container, options §5.5, ELK → relative positions/sizes), worker via
`?worker&inline`, stale-result discard, "Calculando layout…" > 300 ms, fit view after layout;
tests call elkjs directly.

- Test: layout of example (expanded all) returns positions for all 27 nodes; perf sanity
  (300 synthetic nodes < 1 s, logged not asserted if flaky — record in DECISIONS).

**T5.3 Expand/collapse.** Double-click toggle, header collapse button, persisted `sysviz:ui:<id>`,
restore on open (§5.6), selection falls back to visible ancestor.

- AC: A3 in browser; reload keeps expansion.

**T5.4 Drag + persistence + reset.** Saved positions override ELK, group bbox recompute,
negative compensation (from T3.4), save only on drag stop, `updatedAt`; "Resetar layout" with
confirm.

- AC: A9, A10; single-file build still works (worker inline).

**Checkpoint 5:** gate; A2–A5, A9, A10 in browser; check `build:single` layout works on `file://`.

## Phase 6 — Details panel & editing (§6.6)

**T6.1 Read-only panel** for node/edge/aggregated edge/flow/system; children & connections
navigable; links only `http(s)` with `noopener noreferrer`; copy id.
**T6.2 Node edit form** (all editable fields, links/metadata rows, unique keys) validated with
the Zod schema, per-field errors, Save disabled when invalid, persist + `updatedAt`.

- Component test: open panel, edit `name` (§12). AC A11.
  **T6.3 Edge / flow / system edit forms** (same pattern; aggregated → pick original).

**Checkpoint 6:** gate; A11 incl. reload + export.

## Phase 7 — Flows (§6.5)

**T7.1 Flow selector + highlight** (highlight, 30% dim, badges, "Expandir caminho" + relayout

- fit). AC A6, A7.
  **T7.2 Step bar** (prev/next, ←/→ with input-focus guard, emphasis, center, panel shows original
  edge + note, "Este passo está dentro de <nó>. [Expandir]"). AC A8.

**Checkpoint 7:** gate; A6–A8.

## Phase 8 — Search, filters, levels, legend, theme (§6.4)

**T8.1 Search** (`/`, accent/case-insensitive over name/id/technology, hierarchical path, expand
ancestors + center + 2 s pulse). Pure matcher in `graph/` with tests. AC A15.
**T8.2 Filters** (type, platform incl. "sem hosting", 25% dim, group not dimmed if any
descendant matches, edge dim rule, min-opacity combine with flow, active indicator + clear).
Pure `dimmedIds` with tests. AC A16.
**T8.3 Levels menu + Legend + Theme + Esc/shortcuts + responsive drawers (<900px) + a11y
basics** (aria-labels, focus trap in dialogs).

**Checkpoint 8:** gate; A15, A16; keyboard-only pass.

## Phase 9 — "Gerar com IA" (§9)

**T9.1 `prompts/createPrompt.ts`, `evolvePrompt.ts`** — literal §9 text, placeholder
substitution (schema, example, current doc without `layout`).

- Test: placeholders replaced; evolve prompt has no `layout`; literal text byte-equal to spec.
  **T9.2 AiPromptDialog** two tabs, copy, instructions, "Importar JSON" → import dialog;
  "Sobre/Ajuda" note on `file://` storage. AC A17.

**Checkpoint 9:** gate; A17.

## Phase 10 — Builds & acceptance sweep (§2.1, §11, §13)

**T10.1 PWA finalize** — icons, manifest, offline precache; A19 (Chrome/Edge install offline,
Firefox reload offline).
**T10.2 Single-file finalize** — A18 (double-click, offline, import/export/persist).
**T10.3 Full A1–A21 sweep** in browser + network-request audit (zero runtime requests) +
`DECISIONS.md` review; fix regressions as their own tasks.

**Checkpoint 10 (final):** A1–A21 all pass; gate green; both builds verified offline.

---

## Verification (applies throughout)

- Per task: the gate (`npm test && npm run typecheck && npm run lint`).
- Logic acceptance (A2–A7) proven by Vitest against the §10 example — never edit example/criteria.
- UI acceptance: run `npm run dev` in the built-in browser pane, exercise the criterion, check
  console + network panel (no external requests).
- Builds: `npm run build` + static serve for PWA; open `dist-single/sys-viz.html` via `file://`.

## Risks / open points (recorded in DECISIONS.md when hit)

- Plugin compatibility may force previous Vite major (T1.1).
- React Flow in jsdom: if DOM node counts are flaky, assert on store-derived nodes (§12 allows).
- ELK group sizing vs saved positions overlap — accepted limitation (§15).
- `react/jsx-no-literals` may flag symbols like `×`, `›`, `–` — put them in i18n too.
- No git yet: T1.1 runs `git init` so `/build` can commit per task (drop if you prefer no git).
