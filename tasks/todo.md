# sys-viz — TODO

Details, acceptance criteria and verification per task: [plan.md](plan.md).
Gate after every task: `npm test && npm run typecheck && npm run lint`.

## Phase 1 — Scaffold

- [x] T1.1 Project skeleton + pinned deps (+ git init, DECISIONS.md)
- [x] T1.2 Tailwind v4 + i18n seed
- [x] T1.3 ESLint (flat, jsx-no-literals) + Prettier
- [x] T1.4 Vitest + `src/test/setup.ts` mocks + smoke test
- [x] T1.5 `build` (PWA) + `build:single` (sys-viz.html) working
- [x] **Checkpoint 1** — both builds produce artifacts; review pinned versions

## Phase 2 — Schema & validation

- [x] T2.1 Zod schema + example-system.json (verbatim §10)
- [x] T2.2 validate — error rules 1–9
- [x] T2.3 validate — warnings 1–4; example = 0 errors / 0 warnings
- [x] T2.4 migrations + jsonSchema
- [x] T2.5 import/preprocess
- [x] **Checkpoint 2**

## Phase 3 — Graph logic

- [ ] T3.1 tree + visibility (9 / 13 / 27 nodes)
- [ ] T3.2 aggregateEdges (9 / 12 / 21 edges)
- [ ] T3.3 flowPath (formatSteps, badges, expandPath)
- [ ] T3.4 positions (merge, bbox, negative compensation)
- [ ] **Checkpoint 3** — A2–A4, A6 badges, A7 at logic level

## Phase 4 — Storage, store, sidebar

- [ ] T4.1 storage/localStore (rollback, quota, corruption, index repair)
- [ ] T4.2 Zustand store + first run loads example (A1) + Error Boundary
- [ ] T4.3 Sidebar: list, open, rename, duplicate, delete, corrupted banner, empty state
- [ ] T4.4 Import dialog + importSystem conflicts (A12, A13, A14)
- [ ] T4.5 Export system + backup export/import (A20)
- [ ] **Checkpoint 4**

## Phase 5 — Canvas

- [ ] T5.1 Nodes/groups/edges rendering (A5; 9/9 component test)
- [ ] T5.2 ELK layout in inline worker
- [ ] T5.3 Expand/collapse + persisted expansion (A3)
- [ ] T5.4 Drag + saved positions + reset layout (A9, A10)
- [ ] **Checkpoint 5** — incl. layout on `file://`

## Phase 6 — Details panel

- [ ] T6.1 Read-only panel (node/edge/aggregated/flow/system)
- [ ] T6.2 Node edit form (A11)
- [ ] T6.3 Edge / flow / system edit forms
- [ ] **Checkpoint 6**

## Phase 7 — Flows

- [ ] T7.1 Flow selector, highlight, badges, Expandir caminho (A6, A7)
- [ ] T7.2 Step bar + ←/→ (A8)
- [ ] **Checkpoint 7**

## Phase 8 — Navigation

- [ ] T8.1 Search (A15)
- [ ] T8.2 Filters + combined dimming (A16)
- [ ] T8.3 Levels, legend, theme, shortcuts, drawers, a11y
- [ ] **Checkpoint 8**

## Phase 9 — Gerar com IA

- [ ] T9.1 createPrompt / evolvePrompt (literal text)
- [ ] T9.2 AiPromptDialog + Sobre/Ajuda (A17)
- [ ] **Checkpoint 9**

## Phase 10 — Builds & acceptance

- [x] T10.1 PWA offline (A19)
- [x] T10.2 Single-file offline (A18)
- [x] T10.3 Full A1–A21 sweep + zero-network audit
- [x] **Checkpoint 10 (final)**
