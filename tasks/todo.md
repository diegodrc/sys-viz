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

- [x] T3.1 tree + visibility (9 / 13 / 27 nodes)
- [x] T3.2 aggregateEdges (9 / 12 / 21 edges)
- [x] T3.3 flowPath (formatSteps, badges, expandPath)
- [x] T3.4 positions (merge, bbox, negative compensation)
- [x] **Checkpoint 3** — A2–A4, A6 badges, A7 at logic level

## Phase 4 — Storage, store, sidebar

- [x] T4.1 storage/localStore (rollback, quota, corruption, index repair)
- [x] T4.2 Zustand store + first run loads example (A1) + Error Boundary
- [x] T4.3 Sidebar: list, open, rename, duplicate, delete, corrupted banner, empty state
- [x] T4.4 Import dialog + importSystem conflicts (A12, A13, A14)
- [x] T4.5 Export system + backup export/import (A20)
- [x] **Checkpoint 4**

## Phase 5 — Canvas

- [x] T5.1 Nodes/groups/edges rendering (A5; 9/9 component test)
- [x] T5.2 ELK layout in inline worker
- [x] T5.3 Expand/collapse + persisted expansion (A3)
- [x] T5.4 Drag + saved positions + reset layout (A9, A10)
- [x] **Checkpoint 5** — incl. layout on `file://`

## Phase 6 — Details panel

- [x] T6.1 Read-only panel (node/edge/aggregated/flow/system)
- [x] T6.2 Node edit form (A11)
- [x] T6.3 Edge / flow / system edit forms
- [x] **Checkpoint 6**

## Phase 7 — Flows

- [x] T7.1 Flow selector, highlight, badges, Expandir caminho (A6, A7)
- [x] T7.2 Step bar + ←/→ (A8)
- [x] **Checkpoint 7**

## Phase 8 — Navigation

- [x] T8.1 Search (A15)
- [x] T8.2 Filters + combined dimming (A16)
- [x] T8.3 Levels, legend, theme, shortcuts, drawers, a11y
- [x] **Checkpoint 8**

## Phase 9 — Gerar com IA

- [x] T9.1 createPrompt / evolvePrompt (literal text)
- [x] T9.2 AiPromptDialog + Sobre/Ajuda (A17)
- [x] **Checkpoint 9**

## Phase 10 — Builds & acceptance

- [ ] T10.1 PWA offline (A19) — offline reload from cache verified; **install on Chrome/Edge is manual**
- [x] T10.2 Single-file offline (A18) — self-contained; `file://` double-click checked manually by the user (2026-11-25)
- [x] T10.3 Full A1–A21 sweep + zero-network audit → [acceptance.md](acceptance.md)
- [ ] **Checkpoint 10 (final)** — waiting on the manual checks above; §11 layout target not met in the embedded browser

## Phases 11–16 — Lógica de negócio (SPEC §18)

- [x] T11 Schema v2 (`logic`), migração 1→2, validação §18.5, exemplo v2 (L1, L2)
- [x] T12 Índice de lógica, `followTrigger`, busca por campo
- [x] T13 Indicadores no mapa, "Abrir lógica", "Usada em", "Ver lógica" (L3, L9)
- [x] T14 Tela de lógica: trilha, layout ELK, cartões, filtro, painel e edição (L4–L6, L11, L12)
- [x] T15 "Seguir" e busca por campo na UI (L7, L8, L10)
- [x] T16 Aba "Mapear lógica" e prompts v2 (§18.10, §18.12)
