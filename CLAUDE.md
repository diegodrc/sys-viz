# sys-viz

Visualizador web estático (sem backend, 100% offline) de arquiteturas de sistemas descritas em JSON,
com nós aninhados expansíveis, agregação de arestas e fluxos passo a passo.

**Fonte da verdade: [SPEC.md](SPEC.md).** "DEVE" = requisito; "PODE" = opcional. Leia só as seções
relevantes à tarefa (mapa abaixo), não o arquivo inteiro.

## Estado atual

Etapas 1–7 concluídas (scaffold; schema/validate; `graph/`; storage + store + sidebar +
importar/exportar/backup; canvas React Flow + ELK; painel de detalhes + edição; fluxos). Próxima
etapa = **etapa 8 da seção 14** (busca, filtros, legenda, níveis, tema, atalhos). Plano e
checklist: [tasks/plan.md](tasks/plan.md), [tasks/todo.md](tasks/todo.md). Atualize esta linha ao
concluir cada etapa.

## Stack (SPEC §2)

Vite + TypeScript strict (+ `noUncheckedIndexedAccess`) · React 18+ · `@xyflow/react` · elkjs
(`elk.bundled.js` em Web Worker `?worker&inline`) · Zod 4 · Zustand · Tailwind v4 (via CSS,
`@tailwindcss/vite`, sem `tailwind.config.js`) · lucide-react · Vitest + Testing Library ·
vite-plugin-pwa · vite-plugin-singlefile · Node 20.19+, npm. Versões fixadas e motivos: `DECISIONS.md`
(TS 6.0, ESLint 9, vitest 4, jsdom 29 — majors mais novas quebram compat ou exigem Node 22).
Versões **exatas** (sem `^`), registradas em `DECISIONS.md`.

## Comandos (SPEC §2.1)

- `npm run dev` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run format`
- `npm run build` → `dist/` (PWA) · `npm run build:single` → `dist-single/sys-viz.html` (sem SW)
- **Ao fim de cada etapa:** `npm test && npm run typecheck && npm run lint` — tudo verde.

## Mapa da spec (carregue por tarefa)

| Tarefa                                                             | Seções                         |
| ------------------------------------------------------------------ | ------------------------------ |
| Schema, validação, migrações                                       | §4 (+ §12 validate/jsonSchema) |
| Lógica de grafo (tree, visibility, aggregate, flowPath, positions) | §3, §5.4, §6.5, §12, §13 A2–A7 |
| Layout ELK, arrasto, posições                                      | §5.5, §5.6                     |
| Storage / localStorage                                             | §7                             |
| Importar / exportar / backup                                       | §4.3, §4.4, §6.2, §6.3         |
| Canvas, nós, arestas                                               | §5.2, §5.3                     |
| Busca, filtros, níveis, atalhos, tema                              | §6.4                           |
| Painel de detalhes / edição                                        | §6.6                           |
| Prompts de IA (texto literal — não alterar)                        | §9                             |
| Exemplo (não alterar)                                              | §10                            |
| Estilo de código / ESLint / Prettier                               | §16                            |

## Arquitetura (SPEC §8)

`src/{schema,graph,storage,import,store,components,prompts,theme,i18n,examples,test}`.
Lógica pura em `graph/`, `schema/`, `import/` (sem `window`/`localStorage`/React, sem mutar
entrada). Componentes só renderizam e despacham ações. Todo localStorage via `src/storage/`.

## Convenções essenciais (SPEC §16)

- Sem `any` explícito; `as` só com comentário justificando.
- Erros esperados como valor: `{ ok: true, value } | { ok: false, errors }`.
- `SysNode` (tipo, via `z.infer`) + `SysNodeSchema` (Zod). Sem `.default()` no Zod.
- `PascalCase.tsx` (um componente por arquivo), `camelCase.ts`, teste ao lado (`x.test.ts`).
- Código/comentários em inglês; textos de UI e mensagens de validação em pt-BR, **todos** em
  `src/i18n/pt-BR.ts` (lint `react/jsx-no-literals` garante).
- Prettier: 2 espaços, aspas simples, `;`, `printWidth: 100`, trailing commas.

## Limites (SPEC §17)

- **Sempre:** seguir §14 uma etapa por vez; testes da §12 junto com a lógica; registrar em
  `DECISIONS.md` toda escolha não determinada pela spec (data, decisão, motivo).
- **Perguntar antes:** dependência fora da §2; mudar schema (§4) ou prompts (§9); divergir de DEVE.
- **Nunca:** rede/CDN/fontes externas/telemetria em runtime; `dangerouslySetInnerHTML`, `eval`,
  `new Function`; alterar exemplo (§10) ou critérios (§13) para passar teste; desligar lint/strict
  ou usar `.skip`; operações estruturais (criar/excluir nós/arestas).

## Armadilhas conhecidas

- Compatibilidade Vite × vite-plugin-pwa × vite-plugin-singlefile: se a major mais nova do Vite
  não for suportada, usar a anterior.
- jsdom não tem `ResizeObserver`/`DOMMatrixReadOnly`/medidas: mockar em `src/test/setup.ts` e
  chamar elkjs direto (sem worker) nos testes.
- Rotas do ELK são descartadas; arestas = `smoothstep` do React Flow.
- Posições salvas são relativas ao pai.
- Repositório git em `main`; um commit por etapa (fim de cada fase do `tasks/plan.md`).
- Aviso 1 da §4.2 (passos de fluxo) é sensível a ramificação — ver `DECISIONS.md`.
- Dev server: `.claude/launch.json` fixa a porta 5173 (`--strictPort`); o preview em 4173.
- Testes de componente: injete um store com `createAppStore({ storage: testStorage(), ... })`
  (`src/test/storage.ts`); o user-event instala seu próprio stub de clipboard.
- React Flow fixado na **v12** (12.12.1), não v13 — ver `DECISIONS.md`. Use a API v12
  (`applyNodeChanges`, `NodeProps<T>`, `parentId`).
- No painel do navegador a aba pode ficar `document.hidden`: screenshots/rAF ficam parados; verifique
  pelo DOM (`.react-flow__node`, `.react-flow__edge`) e pelo localStorage.
- Aba `document.hidden` no painel também **não recebe cliques reais**; dirija a UI por eventos DOM
  (`dispatchEvent`, setter nativo de `value` + evento `input`).
- Não usar `python3` no Bash (é o stub da Microsoft Store e trava); use `node`.
