# sys-viz — Especificação v1

> Documento destinado a um **agente de IA de código** que irá implementar a aplicação.
> Seja literal: onde esta spec diz "DEVE", é requisito; onde diz "PODE", é opcional.
> Em caso de ambiguidade não resolvida aqui, escolha a opção mais simples e registre a decisão em `DECISIONS.md`.

---

## 1. Visão geral

**sys-viz** é uma aplicação web estática (sem backend) para **visualizar arquiteturas e fluxos de sistemas** em múltiplos níveis: o usuário vê o sistema de forma macro e expande nós para ver subsistemas e componentes, com profundidade livre.

- Os sistemas são descritos em **JSON** (formato definido na seção 4).
- O JSON é normalmente **gerado por um agente de IA** (ChatGPT, Claude, Copilot etc.) a partir de um **prompt padrão** fornecido pelo próprio site (seção 9). O agente entrevista o usuário e devolve o JSON, que é importado no site.
- Os dados ficam no **localStorage** do navegador. Vários sistemas podem coexistir.
- O site é **um visualizador**: não cria nem remove nós/arestas. Permite apenas **editar propriedades** de elementos existentes e **arrastar nós** (posição salva).

### 1.1 Caso de uso inicial

Mapear um sistema corporativo com: frontend atrás de CDN (Akamai) publicado em Kubernetes → API via proxy Apigee → API .NET em Kubernetes → fila implementada como tabela SQL Server → worker → CA Gateway → outra API em Kubernetes → consulta banco e publica em duas exchanges RabbitMQ (direct) → duas filas → dois consumers → bancos e API externa. Esse cenário, com nomes genéricos, é o **sistema de exemplo** (seção 10) e base dos critérios de aceite.

### 1.2 Fora de escopo (v1)

- Criar, excluir ou mover (mudar de pai) nós; criar, excluir ou religar arestas; criar/excluir fluxos ou alterar seus passos.
- Backend, login, colaboração, sincronização entre dispositivos.
- Histórico/versionamento de alterações, desfazer/refazer.
- Exportar imagem (PNG/SVG).
- Internacionalização (apenas pt-BR, mas textos centralizados — ver 11.4).
- Chamar APIs de IA diretamente do site.

---

## 2. Stack e restrições técnicas

| Item | Escolha |
|---|---|
| Build | **Vite** (última estável) + **TypeScript** (`strict: true`) |
| UI | **React 18+** |
| Grafo | **React Flow** (`@xyflow/react`) — nós aninhados via `parentId` |
| Layout automático | **elkjs** (`elk.bundled.js`), algoritmo `layered` |
| Validação | **Zod 4** (schema único; JSON Schema gerado com `z.toJSONSchema`) |
| Estado | **Zustand** (+ persistência própria no localStorage, ver seção 7) |
| Estilo | **Tailwind CSS** |
| Ícones | **lucide-react** (empacotado, sem CDN) |
| Testes | **Vitest** (+ `@testing-library/react` para componentes críticos) |
| PWA | **vite-plugin-pwa** |
| HTML único | **vite-plugin-singlefile** |
| Node | 20+; gerenciador **npm** |

Restrições:

- **Nenhum recurso externo em runtime**: sem CDN, sem Google Fonts, sem telemetria. Tudo empacotado. A aplicação DEVE funcionar 100% offline.
- **Sem backend** e sem chamadas de rede em runtime.
- Navegadores-alvo: Chrome/Edge e Firefox atuais.
- **Versões fixadas**: no scaffold, escolher versões exatas compatíveis entre si (em especial Vite × vite-plugin-pwa × vite-plugin-singlefile, que podem atrasar suporte a uma major nova do Vite), fixá-las no `package.json` (sem `^`) e registrá-las em `DECISIONS.md`. Se a última major do Vite não for suportada pelos plugins, usar a anterior.
- **Tailwind CSS v4**, configurado via CSS (`@import "tailwindcss"`, `@theme`) com o plugin `@tailwindcss/vite`; sem `tailwind.config.js`.
- **Clipboard**: usar `navigator.clipboard.writeText` com fallback para `textarea` + `document.execCommand('copy')` se a API falhar ou não existir.

### 2.1 Targets de build

| Script | Saída | Descrição |
|---|---|---|
| `npm run dev` | — | servidor de desenvolvimento |
| `npm run build` | `dist/` | **PWA**: site estático com service worker (`registerType: 'autoUpdate'`), manifest, ícones 192/512. Hospedável em qualquer host estático (ex.: GitHub Pages) — usar `base: './'`. |
| `npm run build:single` | `dist-single/sys-viz.html` | **HTML único**: todo JS/CSS/ícones/worker inline, abre por duplo clique (`file://`). **Não** registra service worker nesse modo (usar `import.meta.env.MODE === 'single'` ou variável equivalente). O plugin gera `index.html`; o script DEVE renomeá-lo para `sys-viz.html` (ex.: passo pós-build em Node). |
| `npm test` | — | Vitest |
| `npm run typecheck` | — | `tsc --noEmit` |
| `npm run lint` | — | ESLint |

Observação a exibir na tela "Sobre/Ajuda": no HTML único aberto via `file://`, o localStorage é separado da versão hospedada; para mover dados use exportar/importar backup.

---

## 3. Conceitos

- **Sistema (documento)**: um arquivo JSON com nós, arestas, fluxos e layout. É a unidade importada/exportada e listada na barra lateral.
- **Nó**: qualquer elemento (aplicação, API, fila, banco, gateway...). Pode conter **filhos** (`children`) com profundidade livre.
  - Nó **folha**: sem filhos.
  - Nó **grupo**: com filhos; pode estar **colapsado** (renderizado como um nó comum com badge) ou **expandido** (renderizado como contêiner com os filhos dentro).
- **Aresta**: conexão dirigida entre dois nós quaisquer, em qualquer nível da hierarquia.
- **Fluxo**: sequência ordenada de arestas com nome (ex.: "Processamento de pedido").
- **Nó visível**: nó cujos ancestrais estão todos expandidos.
- **Hosting**: onde o nó roda (Kubernetes, VM, SaaS...). É **atributo**, nunca nó contêiner.
- **Confidence**: `confirmed` (padrão) ou `assumed` (camada presumida, ex.: Ingress NGINX que o usuário não sabe se existe).

### 3.1 Convenção de direção das arestas

A direção da aresta segue o **caminho do dado/requisição no fluxo**, não necessariamente quem inicia a conexão:

- Chamada HTTP: chamador → chamado.
- Escrita em fila/tabela: produtor → fila.
- Leitura de fila (push ou polling): fila → consumidor (quem inicia fica em `metadata.initiator` se relevante).
- Binding RabbitMQ: exchange → fila (routing key em `metadata.routingKey`).

---

## 4. Formato JSON (schema v2)

### 4.1 Tipos (referência TypeScript — o schema Zod DEVE ser equivalente)

```ts
type SchemaVersion = 1;

type NodeType =
  | "system"        // sistema/agrupador lógico
  | "application"   // aplicação/serviço implantável
  | "frontend"
  | "api"
  | "worker"
  | "consumer"
  | "component"     // módulo/classe/etapa interna
  | "cdn"
  | "gateway"       // API gateway, proxy (Apigee, CA Gateway...)
  | "ingress"       // ingress controller, NGINX, load balancer
  | "broker"        // RabbitMQ, Kafka...
  | "exchange"
  | "queue"         // qualquer fila (inclusive tabela usada como fila)
  | "topic"
  | "database"
  | "table"
  | "cache"
  | "storage"
  | "external"      // sistema de terceiros
  | "user"          // ator humano/cliente
  | "other";

type HostingPlatform =
  | "kubernetes" | "vm" | "serverless" | "paas" | "saas" | "on-premise" | "other";

type Confidence = "confirmed" | "assumed";

interface Hosting {
  platform: HostingPlatform;
  cluster?: string;
  namespace?: string;
  details?: string;
}

interface Link {
  label: string;
  url: string;           // string; validar apenas que não é vazia
}

interface SysNode {
  id: string;            // único no documento; regex ^[a-z0-9][a-z0-9-]*$ ; imutável
  name: string;          // 1..80 chars
  type: NodeType;
  description?: string;
  technology?: string;   // ex.: ".NET 8", "SQL Server 2019", "RabbitMQ 3.12"
  hosting?: Hosting;
  owner?: string;        // time responsável
  links?: Link[];
  metadata?: Record<string, string>; // chave/valor livre, valores sempre string
  confidence?: Confidence;            // ausente = "confirmed" (ver nota abaixo)
  children?: SysNode[];
}

interface SysEdge {
  id: string;            // único no documento; mesma regex de id
  source: string;        // id de nó existente
  target: string;        // id de nó existente
  protocol?: string;     // ex.: "HTTPS", "AMQP", "SQL", "gRPC"
  mode?: "sync" | "async";
  label?: string;        // rótulo curto exibido na aresta (até 40 chars)
  description?: string;
  metadata?: Record<string, string>; // endpoint, método, exchange, routingKey, tabela...
  confidence?: Confidence;
}

// Notas de schema:
// - NÃO usar .default() no Zod: a ausência de `confidence` (ou `mode`) é tratada como
//   "confirmed" (ou "sync") apenas na renderização, para que a exportação preserve o
//   documento como foi importado.
// - `label` de aresta: max(40) no schema (excesso é erro de importação).
// - Objetos usam parsing que descarta chaves desconhecidas (comportamento padrão do
//   z.object), e o validador as reporta como aviso (4.2, aviso 4).

interface FlowStep {
  edgeId: string;        // id de aresta existente
  note?: string;         // explicação do passo
}

interface Flow {
  id: string;            // único entre fluxos; mesma regex de id
  name: string;          // 1..80 chars
  description?: string;
  steps: FlowStep[];     // 1+ passos, em ordem
}

interface Position { x: number; y: number; }

interface SystemDoc {
  schemaVersion: 2; // v1 é migrado na importação (§4.5)
  id: string;            // id do sistema; mesma regex
  name: string;
  description?: string;
  nodes: SysNode[];      // nós de nível raiz (1+)
  edges: SysEdge[];
  flows?: Flow[];
  layout?: {
    // posição salva do nó, RELATIVA ao canto superior esquerdo do pai
    // (ou ao canvas, se nó raiz). Só contém nós que o usuário arrastou.
    positions?: Record<string, Position>;
  };
}
```

### 4.2 Regras de validação

Erros (impedem importação):

1. JSON sintaticamente inválido (mostrar linha/coluna quando possível).
2. Falha de schema Zod (campo obrigatório ausente, tipo errado, enum inválido, `schemaVersion` diferente de 2 depois da migração da §4.5).
3. `id` de nó duplicado em qualquer lugar da árvore.
4. `id` de aresta duplicado; `id` de fluxo duplicado.
5. Aresta com `source` ou `target` inexistente.
6. Aresta cujo `source` é ancestral do `target` ou vice-versa (ou `source === target`).
7. Passo de fluxo referenciando aresta inexistente.
8. Limites de robustez excedidos: texto de entrada > 5 MB, profundidade de `children` > 20, ou mais de 2000 nós no documento. A verificação de tamanho ocorre antes do parse e a de profundidade antes do Zod (para evitar estouro de pilha).
9. Chave de `metadata` igual a `__proto__`, `constructor` ou `prototype`.

Avisos (importa, mas lista para o usuário):

1. Passos consecutivos de fluxo não conectados (target do passo N ≠ source do passo N+1) — é permitido porque fluxos podem ramificar.
2. `layout.positions` com id de nó inexistente (a entrada é descartada).
3. Nó raiz isolado: nem ele nem nenhum de seus descendentes participa de qualquer aresta. (Grupos cujas arestas ligam apenas filhos, como `portal-web` no exemplo, **não** geram aviso.)
4. Campos desconhecidos (não previstos no schema) em qualquer objeto: são **descartados** e listados no aviso com o path (ex.: `nodes[3].foo`).

Cada erro/aviso DEVE ter: `severity`, `path` (ex.: `edges[12].target`), `message` em pt-BR com o id envolvido (ex.: `A aresta "e13" aponta para o nó inexistente "exchange-x".`).

### 4.3 Pré-processamento na importação

- Remover cercas Markdown se presentes (```` ```json ... ``` ````) e espaços antes/depois — usuários colarão a resposta da IA como veio.
- Se o texto contiver mais de um bloco de código, usar o primeiro que for JSON válido.
- Se não houver cercas e o texto não for JSON válido (ex.: IA respondeu com prosa em volta), tentar o trecho do primeiro `{` ao último `}`. Se ainda falhar, reportar o erro de parse do texto original.

### 4.4 Formato de backup (todos os sistemas)

```json
{
  "sysvizBackup": 1,
  "exportedAt": "2026-11-24T12:00:00.000Z",
  "systems": [ /* SystemDoc[] */ ]
}
```

O importador DEVE detectar automaticamente se o arquivo é um `SystemDoc` (tem `schemaVersion`) ou um backup (tem `sysvizBackup`).

### 4.5 Migrações

Manter `src/schema/migrations.ts` com um mapa `schemaVersion → função de migração`. A migração `1 → 2` só troca a versão (a v2 apenas acrescenta o campo opcional `logic`, §18.4); versões maiores que a suportada geram erro claro ("Este arquivo foi gerado por uma versão mais nova do sys-viz").

---

## 5. Visualização

### 5.1 Layout da tela

```
┌───────────────────────────────────────────────────────────────────────┐
│ Topbar: [☰] Nome do sistema ▾ | Busca | Filtros | Fluxo ▾ | Níveis | ☀/☾ │
├──────────┬──────────────────────────────────────────────┬─────────────┤
│ Sidebar  │                                              │ Painel de   │
│ sistemas │            Canvas (React Flow)               │ detalhes    │
│ (recolhí-│      minimapa ↘  controles zoom ↙            │ (abre ao    │
│  vel)    │      barra do fluxo (passo a passo) ↓        │ selecionar) │
└──────────┴──────────────────────────────────────────────┴─────────────┘
```

- Sidebar e painel de detalhes são recolhíveis. Em telas < 900px, ambos viram drawers sobrepostos.

### 5.2 Renderização de nós

- Cada `type` tem **ícone** (lucide) e **cor** definidos em um único mapa `src/theme/nodeTypes.ts`. Exemplo: `database` → `Database`; `queue` → `ListOrdered`; `gateway` → `Shield`; `cdn` → `Globe`; `api` → `Server`; `frontend` → `Monitor`; `worker` → `Cog`; `consumer` → `Inbox`; `broker` → `Network`; `exchange` → `Shuffle`; `external` → `ExternalLink`; `user` → `User`; `ingress` → `Split`; demais → `Box`.
- Nó folha / grupo colapsado: cartão ~220×64 com ícone, `name`, linha secundária com `technology` (ou `type`), e badges:
  - **hosting** (ex.: ícone + "k8s"), quando existir;
  - **"+N"** em grupos colapsados (N = total de descendentes).
- Grupo expandido: contêiner com cabeçalho (ícone, nome, botão colapsar) e filhos dentro; tamanho calculado pelo layout.
- `confidence: "assumed"`: **borda tracejada** e tooltip "Camada presumida — não confirmada".
- Duplo clique em grupo alterna expandir/colapsar. Clique simples seleciona e abre o painel de detalhes.

### 5.3 Renderização de arestas

- `mode: "sync"` (ou ausente): linha contínua. `mode: "async"`: linha tracejada.
- `confidence: "assumed"`: opacidade 50% e sufixo "(?)" no rótulo.
- Rótulo curto: `label`; se ausente, `protocol`; se ausente, nada.
- Seta no target.

### 5.4 Agregação de arestas (núcleo do comportamento macro/detalhe)

Para cada aresta original `e`:

1. `vs = visibleAncestor(e.source)`, `vt = visibleAncestor(e.target)`, onde `visibleAncestor(n)` é o próprio `n` se visível, senão o ancestral visível mais profundo.
2. Se `vs === vt`, a aresta é **interna** a um nó colapsado e **não é exibida**.
3. Caso contrário, agrupar por par ordenado `(vs, vt)`.

Cada grupo vira uma **aresta renderizada**:

- Se contém 1 aresta original: renderiza como ela (estilo, rótulo).
- Se contém N > 1: rótulo `×N`; estilo tracejado só se todas forem `async`; estilo "presumido" (50% e "(?)") só se todas forem `assumed`; tooltip e painel listam as arestas originais (rótulo, protocolo, origem → destino reais).
- Pares opostos (`A→B` e `B→A`) são arestas renderizadas distintas.

Implementar como função pura `aggregateEdges(doc, expandedIds): RenderedEdge[]` em `src/graph/aggregate.ts`, com testes unitários (seção 12).

### 5.5 Layout automático (ELK)

- Opções base: `elk.algorithm: layered`, `elk.direction: RIGHT`, `elk.hierarchyHandling: INCLUDE_CHILDREN`, `elk.layered.spacing.nodeNodeBetweenLayers: 80`, `elk.spacing.nodeNode: 40`, padding de grupo `[top=48,left=24,bottom=24,right=24]`.
- Entrada do ELK: apenas **nós visíveis** e **arestas renderizadas** (após agregação). Cada aresta é colocada no contêiner do menor ancestral comum (LCA) de suas pontas, como o ELK exige para hierarquia.
- Recalcular layout quando: abrir sistema, expandir/colapsar, resetar layout, importar/substituir.
- **Posições salvas** (`layout.positions`): após o ELK, sobrescrever x/y dos nós que têm posição salva. Em seguida, recalcular o tamanho de cada grupo expandido para envolver todos os filhos (bounding box + padding). Limitação conhecida e aceita: nós arrastados podem sobrepor nós reposicionados pelo ELK; o usuário resolve com "Resetar layout".
- Ao **soltar** um nó arrastado (`onNodeDragStop`), salvar sua posição relativa ao pai em `layout.positions[id]` e persistir.
- **Resetar layout** (botão na topbar, com confirmação): apaga `layout.positions` do sistema inteiro e reaplica o ELK.
- Executar ELK em um **Web Worker** (o `elk.bundled.js` roda na thread principal e bloquearia a UI). Usar worker inline do Vite (`?worker&inline`) para funcionar também no build de HTML único. Mostrar indicador "Calculando layout…" se > 300 ms. Meta: ≤ 1 s para 300 nós visíveis. Se uma nova requisição de layout chegar antes da anterior terminar, descartar o resultado da anterior.
- **Rotas de aresta**: as rotas calculadas pelo ELK são **descartadas**; o ELK fornece apenas posições e tamanhos. As arestas são desenhadas pelo React Flow com tipo `smoothstep`, handle de saída à direita e de entrada à esquerda de cada nó.
- **Arrasto de filho dentro de grupo expandido**: o filho pode ser arrastado para fora da área atual do pai (sem `extent: 'parent'`). Ao soltar, recalcular a caixa do grupo (bounding box dos filhos + padding). Se algum filho ficar com x ou y menor que o padding (inclusive negativo), deslocar a origem do grupo para cima/esquerda e compensar a posição relativa de **todos** os filhos, de modo que nenhum se mova visualmente; persistir as posições afetadas (do grupo, se ele próprio tiver posição salva, e dos filhos). Ancestrais são recalculados em cascata.

### 5.6 Estado inicial ao abrir um sistema

- Se houver estado de expansão salvo (seção 7), restaurá-lo.
- Senão: todos os grupos colapsados (visão macro — apenas nós raiz visíveis).
- Executar "ajustar à tela" após o layout.

---

## 6. Interações

### 6.1 Gerenciar sistemas (sidebar)

- Lista dos sistemas salvos (nome, nº de nós, data da última alteração), ordenada por última abertura.
- Ações por sistema: **abrir**, **renomear** (edita `name`), **duplicar** (novo `id` = `<id>-copia`, `-copia-2`...; nome + " (cópia)", truncando o nome original para que o total não passe de 80 caracteres; o estado de expansão **não** é copiado), **exportar JSON**, **excluir** (diálogo de confirmação com o nome do sistema; remove `sysviz:system:<id>`, `sysviz:ui:<id>` e a entrada do índice).
- O dropdown "Nome do sistema ▾" da topbar lista os sistemas salvos para troca rápida (mesma ordenação da sidebar) e tem o item "Detalhes do sistema", que abre o painel do Sistema (6.6).
- Botões globais: **Importar** (arquivo `.json` ou colar texto), **Exportar backup** (todos), **Gerar com IA** (seção 9).
- Estado vazio (nenhum sistema): mensagem + botões "Carregar exemplo" e "Gerar com IA".
- Na primeira execução (sem nenhuma chave `sysviz:` no localStorage), carregar automaticamente o sistema de exemplo.

### 6.2 Importação

Fluxo:

1. Usuário escolhe arquivo ou cola texto.
2. Pré-processamento (4.3) → parse → migração → validação (4.2).
3. Com **erros**: nada é importado. Exibir lista de erros e botão **"Copiar erros para a IA"**, que copia:
   ```
   O JSON que você gerou para o sys-viz tem os erros abaixo. Corrija-os e devolva o JSON COMPLETO, mantendo todos os ids existentes.
   - <path>: <message>
   ...
   ```
4. Sem erros e `id` **novo**: importar e abrir. Mostrar avisos (se houver) num toast/painel expansível.
5. Sem erros e `id` **já existente**: diálogo com:
   - **Substituir**: troca o documento; **preserva** `layout.positions` do documento antigo para os ids de nós que ainda existem (positions do JSON importado têm precedência se presentes); nós novos ficam no layout automático. Estado de expansão: manter ids que ainda existem.
   - **Importar como cópia**: novo id (regra de duplicar).
   - **Cancelar**.
6. Backup: validar cada sistema; se algum tiver erro, listar e permitir importar só os válidos. Para conflitos de id, um único diálogo: **Substituir todos / Pular existentes / Importar como cópias / Cancelar**.

### 6.3 Exportação

- **Exportar sistema**: baixa `<id>.json` com o `SystemDoc` atual (incluindo `layout.positions` e edições), indentado com 2 espaços. Não inclui estado de expansão.
- **Exportar backup**: baixa `sysviz-backup-AAAA-MM-DD.json`.
- Download via `Blob` + `URL.createObjectURL` (funciona em `file://`).

### 6.4 Navegação no grafo

- Zoom (roda/pinch), pan (arrastar fundo), minimapa, controles zoom +/−/ajustar.
- Topbar → **Níveis**: "Expandir tudo", "Colapsar tudo", "Expandir até nível N" (N = 1..profundidade máxima; nível 1 = apenas nós raiz visíveis).
- **Busca** (atalho `/`): busca por `name`, `id`, `technology` (case/acento-insensitive). Lista de resultados com caminho hierárquico (ex.: `Sistema Pedidos › API Pedidos`). Selecionar um resultado: expande ancestrais, centraliza o nó, seleciona-o e aplica destaque pulsante por 2 s.
- **Filtros**: multiseleção por `type` e por `hosting.platform` (inclui opção "sem hosting"). Nós fora do filtro ficam com opacidade 25% (não somem). Grupo (colapsado **ou expandido**) não é esmaecido se ele ou algum descendente atende ao filtro. Arestas renderizadas são esmaecidas se ambas as pontas estão esmaecidas. Indicador de "filtro ativo" + botão limpar.
- **Esmaecimento combinado**: se filtro e fluxo esmaecem o mesmo elemento, vale a **menor** opacidade (não multiplicar).
- **Atalhos de teclado** (`/`, `←`, `→`) são ignorados quando o foco está em `input`, `textarea`, `select` ou elemento `contenteditable`. `Esc` sempre funciona (no campo, primeiro tira o foco).
- **Seleção de nó oculto**: se o nó selecionado deixar de ser visível (ex.: um ancestral foi colapsado), a seleção passa para o ancestral visível mais profundo.
- **Legenda**: popover listando ícone/cor por `type` presentes no sistema, e estilos de aresta (sync, async, presumida, agregada).
- **Tema**: claro / escuro / sistema; persistido.
- `Esc` limpa seleção e fecha painéis/diálogos.

### 6.5 Fluxos

- Seletor de fluxo na topbar (lista `flows`; "Nenhum" limpa).
- Com fluxo selecionado:
  - Arestas renderizadas que contêm ao menos uma aresta do fluxo ficam destacadas (cor de destaque, mais espessas, animadas); demais arestas e nós fora do caminho ficam com opacidade 30%.
  - **Nó no caminho** (não esmaecido) = nó visível que é ponta de alguma aresta destacada, **ou** nó colapsado que contém (como interna) alguma aresta do fluxo, **ou** grupo expandido que é ancestral de algum desses nós.
  - Cada aresta destacada mostra badge com os números dos passos que contém, em ordem crescente: números separados por vírgula; sequências de **3 ou mais** passos consecutivos viram intervalo com travessão `–` (U+2013). Ex.: `3`; `2,5`; `2,3`; `6–9`; `1,4–6,9`.
  - A visão de expansão atual é **mantida**. Botão **"Expandir caminho"**: expande o mínimo necessário para que toda aresta do fluxo tenha suas duas pontas visíveis (expande ancestrais de source e target de cada passo), recalcula layout e ajusta à tela.
- **Barra passo a passo** (rodapé do canvas): `◀ Anterior | Passo 3 de 21: <label/nota> | Próximo ▶ | ✕`. Atalhos `←`/`→`.
  - Passo atual: aresta renderizada correspondente fica com ênfase máxima; nós de ponta são realçados; canvas centraliza nela.
  - Painel de detalhes mostra a aresta original do passo (com `note`).
  - Se a aresta do passo estiver agregada/oculta (interna a nó colapsado), mostrar dica "Este passo está dentro de <nó>. [Expandir]".

### 6.6 Painel de detalhes e edição

Abre ao selecionar nó, aresta renderizada ou fluxo (pelo seletor, botão "detalhes").

**Nó** — modo leitura mostra todos os campos; botão **Editar** alterna para formulário:

| Campo | Editável | Controle |
|---|---|---|
| `id` | não | texto + botão copiar |
| `name` | sim | input (obrigatório) |
| `type` | sim | select com os valores do enum |
| `description` | sim | textarea |
| `technology` | sim | input |
| `hosting` | sim | select platform (+ "nenhum") e inputs cluster/namespace/details |
| `owner` | sim | input |
| `links` | sim | lista label/url com adicionar/remover linha |
| `metadata` | sim | lista chave/valor com adicionar/remover linha (chaves únicas, não vazias) |
| `confidence` | sim | toggle confirmado/presumido |
| filhos | não | lista somente leitura (clicar navega) |
| conexões | não | lista de arestas de entrada/saída (clicar seleciona) |

**Aresta** — mesmo padrão; `id`, `source`, `target` não editáveis; editáveis: `protocol`, `mode`, `label`, `description`, `metadata`, `confidence`. Aresta renderizada agregada: lista as originais; editar abre a original escolhida.

**Fluxo** — editáveis: `name`, `description`; passos somente leitura (lista numerada clicável, mostrando `note`).

**Sistema** (item "Detalhes do sistema" no dropdown do nome na topbar) — editáveis: `name`, `description`. Clicar no fundo do canvas **não** abre este painel: apenas limpa a seleção e fecha o painel de detalhes.

Regras:

- Salvar valida com o mesmo schema Zod; erros aparecem por campo; botão **Salvar** desabilitado enquanto inválido. **Cancelar** descarta.
- Edições alteram o `SystemDoc` em memória e persistem imediatamente no localStorage; atualizam a data de última alteração (`updatedAt`). Arrastar nó e "Resetar layout" também alteram o documento e atualizam `updatedAt`; expandir/colapsar não.
- Nenhuma operação estrutural (criar/excluir nó/aresta, mudar pai, religar) existe na UI.

---

## 7. Persistência (localStorage)

Todas as chaves com prefixo **`sysviz:`**.

| Chave | Conteúdo |
|---|---|
| `sysviz:index` | `{ version: 1, systems: Array<{ id, name, nodeCount, updatedAt, openedAt }> }` |
| `sysviz:system:<id>` | `SystemDoc` completo (inclui `layout.positions`) |
| `sysviz:ui:<id>` | `{ expandedIds: string[] }` — **não** é exportado |
| `sysviz:prefs` | `{ theme: "light"\|"dark"\|"system", sidebarOpen: boolean, lastOpenedId?: string }` |

Regras:

- Ao iniciar, abrir `lastOpenedId` se existir.
- Entrada corrompida (JSON inválido ou falha de schema): não travar; exibir aviso "Sistema <id> está corrompido" com opções **Baixar conteúdo bruto** e **Remover**.
- Erro de cota (`QuotaExceededError`): exibir mensagem pedindo para exportar backup e excluir sistemas; a alteração que falhou não deve corromper o estado anterior.
- Ordem de gravação (o localStorage não tem transação): 1) gravar `sysviz:system:<id>`; 2) gravar `sysviz:index`. Se o passo 2 falhar, restaurar o valor anterior de `sysviz:system:<id>` (ou removê-lo, se era novo). O estado em memória só é atualizado após as gravações terem sucesso.
- Índice inconsistente: entrada do índice sem `sysviz:system:<id>` correspondente é removida do índice ao iniciar; chave `sysviz:system:<id>` sem entrada no índice é reincluída se for válida.
- Todo acesso ao localStorage passa por um módulo `src/storage/` com try/catch.
- Persistência de posições no arrasto: gravar apenas ao soltar (`onNodeDragStop`), nunca a cada frame.

---

## 8. Arquitetura sugerida

```
src/
  schema/        system.ts (Zod), validate.ts (regras semânticas 4.2), migrations.ts, jsonSchema.ts
  graph/         tree.ts (índices: byId, parentOf, depth, descendants), visibility.ts,
                 aggregate.ts (5.4), flowPath.ts (expandir caminho, números de passos),
                 layout.ts (ELK → posições React Flow), positions.ts (merge de positions)
  storage/       localStore.ts, backup.ts
  import/        preprocess.ts (cercas markdown), importSystem.ts (conflitos)
  store/         useAppStore.ts (Zustand)
  components/    Canvas/, nodes/, edges/, Sidebar/, DetailsPanel/, Topbar/, FlowBar/,
                 ImportDialog/, AiPromptDialog/, Legend/
  prompts/       createPrompt.ts, evolvePrompt.ts (templates da seção 9)
  theme/         nodeTypes.ts (ícone/cor por tipo), tokens
  i18n/          pt-BR.ts (todos os textos de UI)
  examples/      example-system.json (seção 10)
```

Princípios: toda lógica de grafo em funções **puras** e testáveis em `graph/`; componentes React só renderizam e despacham ações.

---

## 9. Prompts de IA

### 9.1 Tela "Gerar com IA"

Diálogo com quatro abas:

1. **Criar novo sistema** — mostra o prompt de criação (9.2) em área somente leitura + botão **Copiar prompt**.
2. **Mapear a partir de repositórios** — mostra o prompt de mapeamento por código (9.4) + **Copiar prompt**. Para agentes com acesso aos repositórios (Claude Code, Copilot, Cursor…).
3. **Evoluir sistema atual** — habilitada se houver sistema aberto; mostra o prompt de evolução (9.3) com o JSON atual embutido + **Copiar prompt**.
4. **Mapear lógica** — habilitada se houver sistema aberto; mostra o prompt de lógica (§18.12) com o JSON atual embutido + **Copiar prompt** (instruções na §18.10).

Abaixo, instruções curtas: "1. Copie o prompt. 2. Cole em um agente de IA (ChatGPT, Claude, Copilot…). 3. Responda às perguntas. 4. Cole o JSON final em Importar." e botão **Importar JSON**. Na aba de repositórios, as instruções são: "1. Abra um agente de IA com acesso aos repositórios do fluxo (Claude Code, Copilot, Cursor…). 2. Cole o prompt e descreva o fluxo passo a passo. 3. Confirme o inventário e responda às perguntas. 4. Cole o JSON final em Importar."

Os placeholders são substituídos em runtime:

- `{{JSON_SCHEMA}}` → `JSON.stringify(z.toJSONSchema(SystemDocSchema), null, 2)`
- `{{EXAMPLE_JSON}}` → conteúdo de `examples/example-system-v2.json` (§18.10)
- `{{CURRENT_JSON}}` → `SystemDoc` atual (sem `layout`, para economizar tokens — as posições são preservadas na importação por id)

### 9.2 Prompt de criação (texto literal)

````text
Você é um arquiteto de software ajudando a mapear um sistema para a ferramenta de visualização "sys-viz". Seu objetivo é entrevistar o usuário e, ao final, gerar UM documento JSON que descreve o sistema, válido segundo o JSON Schema abaixo.

## Como conduzir a entrevista
- Fale no idioma do usuário.
- Faça no máximo 3 perguntas curtas e relacionadas por mensagem. Espere a resposta antes de continuar.
- Comece pelo panorama: qual é o sistema, quem o usa, qual o fluxo principal de ponta a ponta. Depois desça em cada etapa.
- Para cada componente, descubra quando possível: nome, tipo, tecnologia/versão, onde roda (Kubernetes, VM, SaaS...; cluster e namespace se souber), time responsável e o que ele faz.
- Para cada conexão, descubra: protocolo (HTTPS, AMQP, SQL...), se é síncrona ou assíncrona, e detalhes úteis (endpoint e método, exchange, routing key, nome de fila ou tabela).
- Pergunte ativamente sobre camadas que costumam ser esquecidas: CDN/WAF, API gateways e proxies, ingress controllers/NGINX/load balancers na frente de aplicações em Kubernetes, autenticação (IdP/OAuth), filas de erro (DLQ) e retentativas, caches, jobs agendados e integrações externas.
- Quando o usuário não souber se uma camada existe mas ela for típica naquele cenário, inclua-a com "confidence": "assumed" e avise-o disso. Nunca invente detalhes específicos (nomes de tabelas, endpoints) — prefira omitir o campo.
- Identifique os fluxos de negócio principais (ex.: "Cadastro de pedido") e a ordem das conexões em cada um.
- Antes de gerar o JSON, apresente um resumo em texto (componentes, hierarquia, conexões e fluxos) e peça confirmação.

## Regras de modelagem
- Hierarquia: use "children" para agrupar componentes dentro de sistemas/aplicações (profundidade livre). Agrupe por responsabilidade lógica (sistema → aplicação → componente), NUNCA por infraestrutura: Kubernetes, cluster e namespace vão no campo "hosting", não viram nós.
- Gateways, proxies, CDNs, ingress, brokers, exchanges, filas e bancos SÃO nós, pois estão no caminho da requisição.
- Uma tabela de banco usada como fila: nó "type": "queue" com "technology" indicando a tabela (ex.: "SQL Server (tabela)"), dentro do nó do banco.
- Direção das arestas = caminho do dado no fluxo: chamador → chamado; produtor → fila; fila → consumidor (mesmo em polling; registre "initiator" em metadata); exchange → fila (routing key em metadata.routingKey).
- Arestas podem ligar nós de qualquer nível, mas nunca um nó a um ancestral ou descendente dele.
- ids: minúsculos, kebab-case, descritivos e únicos no documento (ex.: "api-pedidos", "e-api-pedidos-fila"). Valores de "metadata" são sempre strings.
- Use "label" curto nas arestas (até 40 caracteres) e "description" para detalhes.
- Cada fluxo é uma lista ordenada de passos referenciando ids de arestas existentes; ramificações entram em sequência (termine um ramo e depois o outro).
- Não inclua o campo "layout".
- Não inclua o campo "logic"; a lógica de negócio é mapeada depois, com o prompt "Mapear lógica".

## Saída final
Quando o usuário confirmar o resumo, responda com UM ÚNICO bloco de código ```json contendo o documento completo, sem comentários dentro do JSON. Antes de responder, verifique: todos os ids são únicos, toda aresta aponta para nós existentes, todo passo de fluxo aponta para arestas existentes, "schemaVersion" é 2.

Se o usuário colar uma lista de erros de validação do sys-viz, corrija e devolva o JSON completo novamente, mantendo os ids.

## JSON Schema
```json
{{JSON_SCHEMA}}
```

## Exemplo de documento válido (apenas referência de formato; não copie o conteúdo)
```json
{{EXAMPLE_JSON}}
```

Comece se apresentando em uma frase e fazendo a primeira pergunta.
````

### 9.3 Prompt de evolução (texto literal)

````text
Você é um arquiteto de software ajudando a ATUALIZAR o mapeamento de um sistema na ferramenta "sys-viz". Abaixo está o documento JSON atual do sistema. Seu objetivo é entender com o usuário o que mudou ou o que falta e devolver o documento COMPLETO atualizado.

## Regras obrigatórias
- NUNCA altere o "id" de nós, arestas, fluxos ou do sistema que já existem. A ferramenta usa os ids para preservar o layout.
- Só remova nós, arestas ou fluxos se o usuário pedir ou confirmar explicitamente. Ao remover um nó, remova também as arestas ligadas a ele e ajuste os fluxos afetados, avisando o usuário.
- Novos elementos seguem as mesmas convenções de id (minúsculos, kebab-case, únicos).
- Mantenha todos os campos existentes que não foram discutidos exatamente como estão.
- Mantenha o campo "logic" como está. Se remover uma aresta ou nó, remova também os handlers e as referências (edgeId) que dependem dele, avisando o usuário.

## Como conduzir
- Fale no idioma do usuário. Faça no máximo 3 perguntas curtas por mensagem.
- Comece com um resumo de 3 a 5 linhas do que o documento atual contém e pergunte o que o usuário quer mudar, detalhar ou corrigir.
- Ofereça investigar camadas comumente esquecidas que não aparecem no documento (CDN/WAF, gateways, ingress/NGINX, autenticação, DLQ/retentativas, caches, jobs, integrações externas). Itens incertos entram com "confidence": "assumed".
- Antes de gerar o JSON, liste as alterações (adicionados, alterados, removidos) e peça confirmação.

## Regras de modelagem
(As mesmas do documento original:) hierarquia lógica via "children", infraestrutura no campo "hosting", gateways/filas/bancos como nós, direção das arestas = caminho do dado (fila → consumidor; exchange → fila com metadata.routingKey), nenhuma aresta entre um nó e seu ancestral/descendente, valores de metadata como string, sem campo "layout".

## Saída final
Após a confirmação, responda com UM ÚNICO bloco ```json com o documento COMPLETO (não um diff), "schemaVersion": 2. Verifique unicidade de ids e referências de arestas e fluxos antes de responder.

Se o usuário colar uma lista de erros de validação do sys-viz, corrija e devolva o JSON completo novamente.

## JSON Schema
```json
{{JSON_SCHEMA}}
```

## Documento atual
```json
{{CURRENT_JSON}}
```

Comece com o resumo do documento atual e a primeira pergunta.
````

### 9.4 Prompt de mapeamento a partir de repositórios (texto literal)

Usa os placeholders `{{JSON_SCHEMA}}` e `{{EXAMPLE_JSON}}`, como o prompt de criação.

````text
Você é um arquiteto de software ajudando a mapear um sistema para a ferramenta de visualização "sys-viz". Você tem acesso aos repositórios envolvidos no fluxo. Seu objetivo é descobrir no código e nas configurações os componentes e as conexões do sistema, confirmar tudo com o usuário e, ao final, gerar UM documento JSON válido segundo o JSON Schema abaixo.

## Etapa 1 — Entender o pedido
- Fale no idioma do usuário.
- O usuário vai descrever o fluxo passo a passo. Se ele ainda não descreveu, peça essa descrição e a lista de repositórios disponíveis antes de investigar.
- Pergunte qual ambiente usar como referência (ex.: produção, homologação) quando as configurações variarem por ambiente. Se o usuário não souber, use produção e registre isso.

## Etapa 2 — Investigar os repositórios
Para cada etapa do fluxo descrito, procure evidências no código e nas configurações. Leia, não execute nada e não altere nenhum arquivo.

O que identificar:
- Aplicações: nome de cada Deployment, StatefulSet ou CronJob do Kubernetes (este é o nome do nó), namespace, cluster se aparecer, imagem e tecnologia (linguagem, framework, versão). Um repositório pode ter mais de uma aplicação (ex.: API e worker), e cada uma vira um nó.
- Entradas: Services, Ingress, rotas expostas, controllers e endpoints de cada API.
- Chamadas HTTP de saída: base URLs, clientes HTTP (HttpClient, Refit, Feign, axios...), endpoint e método chamados, e por qual gateway passam (Apigee, CA Gateway, ingress).
- Bancos de dados: servidor/instância e nome da base (sem credenciais) e as tabelas que cada aplicação lê ou escreve, com a operação (SELECT, INSERT, UPDATE, DELETE, procedure).
- Mensageria: broker, virtual host, exchanges (com tipo: direct, topic, fanout), filas, bindings, routing keys, quem publica e quem consome. Inclua filas de erro (DLQ) e retentativas se estiverem configuradas.
- Outros: caches, storages, jobs agendados e integrações externas.

Onde procurar (os nomes variam; use busca no repositório):
- Kubernetes: manifests YAML (Deployment, Service, Ingress, ConfigMap, CronJob), Helm (Chart.yaml, values*.yaml, templates/), Kustomize, pipelines de CI/CD (azure-pipelines.yml, .gitlab-ci.yml, .github/workflows, Jenkinsfile).
- Configuração: appsettings*.json, application*.yml/.properties, .env.example, config/*.json, docker-compose*.yml, variáveis de ambiente nos manifests e ConfigMaps.
- Banco: connection strings (extraia só servidor e base), DbContext/entidades/migrations (Entity Framework), consultas SQL e Dapper, repositórios de dados, scripts .sql e stored procedures.
- Mensageria: declarações e uso no código (ExchangeDeclare, QueueDeclare, QueueBind, BasicPublish, BasicConsume; configuração de MassTransit, EasyNetQ, Spring AMQP), definitions.json do RabbitMQ, e configs com nomes de exchanges, filas, routing keys e vhost.
- Gateways: bundles de proxy do Apigee (apiproxy/, proxies/*.xml, targets/*.xml), políticas e configurações do CA Gateway, arquivos de rotas.

Segurança: NUNCA copie senhas, tokens, chaves, connection strings completas ou outros segredos para as mensagens ou para o JSON. Registre apenas nomes (servidores, bases, tabelas, filas, endpoints).

## Etapa 3 — Apresentar o inventário e tirar dúvidas
Antes de gerar qualquer JSON, apresente um inventário organizado por etapa do fluxo, com:
- Cada componente e cada conexão encontrados, com a evidência (repositório/caminho:linha) entre parênteses.
- Marcação clara do que foi: CONFIRMADO no código/config, INFERIDO (ex.: pelo nome de uma variável) ou NÃO ENCONTRADO.
- Perguntas objetivas sobre as lacunas: relações que você não conseguiu ligar (ex.: "a URL da variável X aponta para qual aplicação?"), etapas do fluxo do usuário sem evidência nos repositórios, e componentes encontrados que não aparecem no fluxo descrito (pergunte se entram).
Faça no máximo 5 perguntas por mensagem e espere as respostas. Repita até não haver lacunas que mudem o resultado. Peça ao usuário que confirme o inventário final antes de gerar o JSON.

## Regras de modelagem
- Hierarquia: use "children" para agrupar por responsabilidade lógica (sistema → aplicação → componente), NUNCA por infraestrutura: Kubernetes, cluster e namespace vão no campo "hosting" ({"platform": "kubernetes", "cluster": "...", "namespace": "..."}), não viram nós. Guarde o nome do Deployment em metadata.deployment quando for diferente do nome exibido.
- Gateways, proxies, CDNs, ingress, brokers, exchanges, filas e bancos SÃO nós, pois estão no caminho da requisição.
- Banco de dados: um nó "type": "database" por base, com um nó filho "type": "table" para cada tabela usada no fluxo. As arestas de leitura e escrita apontam para a TABELA, não para a base, para que ao expandir a base seja possível ver a interação com cada tabela. Uma tabela usada como fila é "type": "queue" com "technology": "SQL Server (tabela)" (ou o banco correspondente).
- RabbitMQ: um nó "type": "broker". Se houver mais de um virtual host, crie um nó filho do broker por vhost ("type": "other", "technology": "RabbitMQ vhost") contendo suas exchanges e filas. Sempre registre metadata.vhost nas exchanges e filas, metadata.exchangeType nas exchanges e metadata.routingKey nas arestas de publicação e de binding.
- Direção das arestas = caminho do dado no fluxo: chamador → chamado; aplicação → tabela (escrita) e tabela → aplicação (leitura); produtor → exchange; exchange → fila (binding); fila → consumidor (mesmo em polling; registre "initiator" em metadata).
- Endpoints: uma aresta por endpoint relevante, com metadata.endpoint e metadata.method. Operações de banco: metadata.operation (ex.: "SELECT", "INSERT", "UPDATE", "EXEC sp_nome").
- Rastreabilidade: em todo nó e aresta que vier do código, registre a evidência em metadata.source no formato "repositorio/caminho:linha" (várias separadas por "; ").
- Confidence: "confirmed" para o que tem evidência no código/config ou foi confirmado pelo usuário; "assumed" para o que foi inferido ou é uma camada típica não comprovada (ex.: ingress na frente de uma aplicação em Kubernetes sem manifest de Ingress encontrado). Nunca invente nomes de tabelas, filas ou endpoints.
- Arestas podem ligar nós de qualquer nível, mas nunca um nó a um ancestral ou descendente dele.
- ids: minúsculos, kebab-case, descritivos e únicos no documento (ex.: "api-pedidos", "tb-fila-pedidos", "e-api-pedidos-tb-fila"). Valores de "metadata" são sempre strings.
- Use "label" curto nas arestas (até 40 caracteres) e "description" para detalhes.
- Crie um fluxo (em "flows") para o fluxo descrito pelo usuário, com os passos na ordem; ramificações entram em sequência (termine um ramo e depois o outro). Use "note" nos passos para explicar o que acontece.
- Não inclua o campo "layout".
- Não inclua o campo "logic"; a lógica de negócio é mapeada depois, com o prompt "Mapear lógica".

## Saída final
Depois que o usuário confirmar o inventário, gere o documento completo. Se você puder criar arquivos, salve-o como sysviz-<id-do-sistema>.json na raiz do workspace e informe o caminho; caso contrário, responda com UM ÚNICO bloco de código ```json, sem comentários dentro do JSON. Antes de entregar, verifique: todos os ids são únicos, toda aresta aponta para nós existentes, todo passo de fluxo aponta para arestas existentes, "schemaVersion" é 2 e não há nenhum segredo no conteúdo.

Se o usuário colar uma lista de erros de validação do sys-viz, corrija e devolva o JSON completo novamente, mantendo os ids.

## JSON Schema
```json
{{JSON_SCHEMA}}
```

## Exemplo de documento válido (apenas referência de formato; não copie o conteúdo)
```json
{{EXAMPLE_JSON}}
```

Comece se apresentando em uma frase. Se o usuário já descreveu o fluxo e os repositórios, confirme em poucas linhas o que entendeu e comece a investigação; senão, peça essas informações.
````

---

## 10. Sistema de exemplo

Arquivo `src/examples/example-system.json`. Nomes genéricos. Carregado como demo na primeira execução, usado no prompt de criação e nos testes.

Estrutura (nós raiz em negrito):

- **Usuário** (`user`)
- **Akamai** (`cdn`)
- **Portal Web** (`application`, k8s) → Ingress NGINX Portal (`ingress`, *assumed*), Frontend Portal (`frontend`)
- **Apigee** (`gateway`)
- **Sistema Pedidos** (`application`, k8s) → Ingress NGINX Pedidos (*assumed*), API Pedidos (`api`), Worker Fila Pedidos (`worker`, *assumed* quanto ao local), Banco Pedidos (`database`) → Fila Pedidos (`queue`, tabela)
- **CA Gateway** (`gateway`)
- **Sistema Validação** (`application`, k8s) → Ingress NGINX Validação (*assumed*), API Validação (`api`), Banco Validação (`database`), Consumer A (`consumer`), Consumer B (`consumer`), Banco Destino A (`database`), Banco Destino B (`database`)
- **RabbitMQ** (`broker`) → Exchange A, Exchange B (`exchange`), Fila A, Fila B (`queue`)
- **Sistema Externo** (`external`)

```json
{
  "schemaVersion": 1,
  "id": "exemplo-pedidos",
  "name": "Sistema de exemplo — Pedidos",
  "description": "Exemplo genérico: frontend atrás de CDN, APIs em Kubernetes, fila em tabela SQL, gateways e mensageria RabbitMQ.",
  "nodes": [
    { "id": "usuario", "name": "Usuário", "type": "user", "description": "Cliente acessando pelo navegador." },
    { "id": "akamai", "name": "Akamai", "type": "cdn", "technology": "Akamai", "hosting": { "platform": "saas" }, "description": "CDN/WAF na frente do frontend." },
    {
      "id": "portal-web", "name": "Portal Web", "type": "application",
      "hosting": { "platform": "kubernetes" },
      "children": [
        { "id": "ingress-portal", "name": "Ingress NGINX Portal", "type": "ingress", "technology": "NGINX Ingress Controller", "hosting": { "platform": "kubernetes" }, "confidence": "assumed" },
        { "id": "frontend-portal", "name": "Frontend Portal", "type": "frontend", "technology": "SPA", "hosting": { "platform": "kubernetes" } }
      ]
    },
    { "id": "apigee", "name": "Apigee", "type": "gateway", "technology": "Apigee", "hosting": { "platform": "saas" }, "description": "Proxy de API para a API de pedidos." },
    {
      "id": "sistema-pedidos", "name": "Sistema Pedidos", "type": "application",
      "technology": ".NET", "hosting": { "platform": "kubernetes" },
      "children": [
        { "id": "ingress-pedidos", "name": "Ingress NGINX Pedidos", "type": "ingress", "technology": "NGINX Ingress Controller", "hosting": { "platform": "kubernetes" }, "confidence": "assumed" },
        { "id": "api-pedidos", "name": "API Pedidos", "type": "api", "technology": ".NET", "hosting": { "platform": "kubernetes" }, "description": "Recebe a requisição e registra na fila." },
        { "id": "worker-pedidos", "name": "Worker Fila Pedidos", "type": "worker", "technology": ".NET", "hosting": { "platform": "kubernetes" }, "description": "Lê os registros da fila e chama a API de validação para cada um.", "confidence": "assumed", "metadata": { "observacao": "Não confirmado se o worker pertence a esta aplicação." } },
        {
          "id": "db-pedidos", "name": "Banco Pedidos", "type": "database", "technology": "SQL Server",
          "children": [
            { "id": "fila-pedidos", "name": "Fila Pedidos", "type": "queue", "technology": "SQL Server (tabela)", "description": "Tabela usada como fila." }
          ]
        }
      ]
    },
    { "id": "ca-gateway", "name": "CA Gateway", "type": "gateway", "technology": "CA API Gateway" },
    {
      "id": "sistema-validacao", "name": "Sistema Validação", "type": "application",
      "technology": ".NET", "hosting": { "platform": "kubernetes" },
      "children": [
        { "id": "ingress-validacao", "name": "Ingress NGINX Validação", "type": "ingress", "technology": "NGINX Ingress Controller", "hosting": { "platform": "kubernetes" }, "confidence": "assumed" },
        { "id": "api-validacao", "name": "API Validação", "type": "api", "technology": ".NET", "hosting": { "platform": "kubernetes" }, "description": "Verifica dados e publica mensagens nas exchanges." },
        { "id": "db-validacao", "name": "Banco Validação", "type": "database" },
        { "id": "consumer-a", "name": "Consumer A", "type": "consumer", "hosting": { "platform": "kubernetes" }, "description": "Salva dados no Banco Destino A." },
        { "id": "consumer-b", "name": "Consumer B", "type": "consumer", "hosting": { "platform": "kubernetes" }, "description": "Salva dados no Banco Destino B e chama o sistema externo." },
        { "id": "db-destino-a", "name": "Banco Destino A", "type": "database" },
        { "id": "db-destino-b", "name": "Banco Destino B", "type": "database" }
      ]
    },
    {
      "id": "rabbitmq", "name": "RabbitMQ", "type": "broker", "technology": "RabbitMQ",
      "children": [
        { "id": "exchange-a", "name": "Exchange A", "type": "exchange", "metadata": { "exchangeType": "direct" } },
        { "id": "exchange-b", "name": "Exchange B", "type": "exchange", "metadata": { "exchangeType": "direct" } },
        { "id": "fila-a", "name": "Fila A", "type": "queue" },
        { "id": "fila-b", "name": "Fila B", "type": "queue" }
      ]
    },
    { "id": "sistema-externo", "name": "Sistema Externo", "type": "external" }
  ],
  "edges": [
    { "id": "e01", "source": "usuario", "target": "akamai", "protocol": "HTTPS", "mode": "sync", "label": "acessa o portal" },
    { "id": "e02", "source": "akamai", "target": "ingress-portal", "protocol": "HTTPS", "mode": "sync", "confidence": "assumed" },
    { "id": "e03", "source": "ingress-portal", "target": "frontend-portal", "protocol": "HTTP", "mode": "sync", "confidence": "assumed" },
    { "id": "e04", "source": "frontend-portal", "target": "apigee", "protocol": "HTTPS", "mode": "sync", "label": "chama API" },
    { "id": "e05", "source": "apigee", "target": "ingress-pedidos", "protocol": "HTTPS", "mode": "sync", "confidence": "assumed" },
    { "id": "e06", "source": "ingress-pedidos", "target": "api-pedidos", "protocol": "HTTP", "mode": "sync", "confidence": "assumed" },
    { "id": "e07", "source": "api-pedidos", "target": "fila-pedidos", "protocol": "SQL", "mode": "sync", "label": "INSERT na fila" },
    { "id": "e08", "source": "fila-pedidos", "target": "worker-pedidos", "protocol": "SQL", "mode": "async", "label": "polling", "metadata": { "initiator": "worker-pedidos" } },
    { "id": "e09", "source": "worker-pedidos", "target": "ca-gateway", "protocol": "HTTPS", "mode": "sync", "label": "1 chamada por registro" },
    { "id": "e10", "source": "ca-gateway", "target": "ingress-validacao", "protocol": "HTTPS", "mode": "sync", "confidence": "assumed" },
    { "id": "e11", "source": "ingress-validacao", "target": "api-validacao", "protocol": "HTTP", "mode": "sync", "confidence": "assumed" },
    { "id": "e12", "source": "api-validacao", "target": "db-validacao", "protocol": "SQL", "mode": "sync", "label": "consulta dados" },
    { "id": "e13", "source": "api-validacao", "target": "exchange-a", "protocol": "AMQP", "mode": "async", "label": "publica", "metadata": { "routingKey": "rk-a" } },
    { "id": "e14", "source": "api-validacao", "target": "exchange-b", "protocol": "AMQP", "mode": "async", "label": "publica", "metadata": { "routingKey": "rk-b" } },
    { "id": "e15", "source": "exchange-a", "target": "fila-a", "protocol": "AMQP", "mode": "async", "label": "binding rk-a", "metadata": { "routingKey": "rk-a" } },
    { "id": "e16", "source": "exchange-b", "target": "fila-b", "protocol": "AMQP", "mode": "async", "label": "binding rk-b", "metadata": { "routingKey": "rk-b" } },
    { "id": "e17", "source": "fila-a", "target": "consumer-a", "protocol": "AMQP", "mode": "async", "label": "consome" },
    { "id": "e18", "source": "fila-b", "target": "consumer-b", "protocol": "AMQP", "mode": "async", "label": "consome" },
    { "id": "e19", "source": "consumer-a", "target": "db-destino-a", "protocol": "SQL", "mode": "sync", "label": "salva dados" },
    { "id": "e20", "source": "consumer-b", "target": "db-destino-b", "protocol": "SQL", "mode": "sync", "label": "salva dados" },
    { "id": "e21", "source": "consumer-b", "target": "sistema-externo", "protocol": "HTTPS", "mode": "sync", "label": "chama API externa" }
  ],
  "flows": [
    {
      "id": "fluxo-recebimento",
      "name": "Recebimento do pedido",
      "description": "Do clique do usuário até o registro na fila SQL.",
      "steps": [
        { "edgeId": "e01" }, { "edgeId": "e02" }, { "edgeId": "e03" }, { "edgeId": "e04" },
        { "edgeId": "e05" }, { "edgeId": "e06" },
        { "edgeId": "e07", "note": "A API grava o registro na tabela-fila e responde." }
      ]
    },
    {
      "id": "fluxo-processamento",
      "name": "Processamento assíncrono",
      "description": "Do worker até a gravação final e a chamada externa.",
      "steps": [
        { "edgeId": "e08", "note": "Worker lê registros pendentes." },
        { "edgeId": "e09" }, { "edgeId": "e10" }, { "edgeId": "e11" },
        { "edgeId": "e12" },
        { "edgeId": "e13", "note": "Ramo A." }, { "edgeId": "e15" }, { "edgeId": "e17" }, { "edgeId": "e19" },
        { "edgeId": "e14", "note": "Ramo B." }, { "edgeId": "e16" }, { "edgeId": "e18" }, { "edgeId": "e20" }, { "edgeId": "e21" }
      ]
    }
  ]
}
```

---

## 11. Requisitos não funcionais

1. **Offline total** nos dois builds (sem requisições de rede após carregar).
2. **Desempenho**: até 300 nós visíveis e 600 arestas renderizadas com pan/zoom fluidos; layout ≤ 1 s nesse tamanho em máquina comum.
3. **Robustez**: nenhum JSON importado pode travar a aplicação; erros de render capturados por Error Boundary com opção "Voltar à lista de sistemas".
4. **Textos**: todos os textos de UI em `src/i18n/pt-BR.ts` (um objeto exportado), nenhum literal de texto solto em componentes.
5. **Acessibilidade básica**: botões com `aria-label`, foco visível, diálogos com trap de foco, atalhos `/`, `Esc`, `←`, `→`.
6. **Segurança**: nunca usar `dangerouslySetInnerHTML` com dados importados; links do campo `links` abrem com `target="_blank" rel="noopener noreferrer"` e só se começarem com `http://` ou `https://` (caso contrário, exibir como texto).
7. **Tema**: tokens de cor para claro/escuro; contraste AA para texto.

---

## 12. Testes obrigatórios (Vitest)

Unitários (`src/**/*.test.ts`):

- `validate`: cada regra de erro e aviso da seção 4.2 tem ao menos um teste (inclusive limites de tamanho/profundidade sem estouro de pilha e chave `__proto__`); o exemplo da seção 10 valida sem erros e sem avisos.
- `preprocess`: remove cercas ```` ```json ````; escolhe o primeiro bloco JSON válido; mantém JSON puro intacto.
- `aggregateEdges`: casos da seção 13 (contagens exatas); aresta interna oculta; agregação ×N; pares opostos distintos.
- `flowPath`: "expandir caminho" do fluxo `fluxo-processamento` a partir da visão macro expande exatamente `sistema-pedidos`, `db-pedidos`, `sistema-validacao`, `rabbitmq`; badges desse fluxo na visão macro são exatamente: `sistema-pedidos→ca-gateway` = `2`, `ca-gateway→sistema-validacao` = `3`, `sistema-validacao→rabbitmq` = `6,10`, `rabbitmq→sistema-validacao` = `8,12`, `sistema-validacao→sistema-externo` = `14`.
- `formatSteps` (formatação de badge): testar com listas sintéticas — `[3]`→`3`, `[2,5]`→`2,5`, `[2,3]`→`2,3`, `[6,7,8,9]`→`6–9`, `[1,4,5,6,9]`→`1,4–6,9`.
- `positions`: merge na substituição preserva posições de ids remanescentes, descarta ids removidos, posições do JSON importado prevalecem.
- `importSystem`: conflito → substituir / cópia (geração de id `-copia`, `-copia-2`).
- `jsonSchema`: `z.toJSONSchema` gera schema; o exemplo valida contra o Zod.
- `prompts`: os três templates (§9.2, §9.3, §9.4) são idênticos ao texto da spec; placeholders substituídos.
- `storage`: entrada corrompida não lança; `QuotaExceededError` é tratado.

Componentes (mínimo): importar o exemplo e verificar contagem de nós renderizados na visão macro; abrir painel e editar `name`.

Ambiente de testes de componente: jsdom não implementa `ResizeObserver` nem medidas de layout, que o React Flow exige. Fornecer em `src/test/setup.ts` mocks de `ResizeObserver`, `DOMMatrixReadOnly` e dimensões de elementos (`offsetWidth`/`offsetHeight`), e substituir o worker do ELK por chamada direta ao `elkjs` nos testes. Se a contagem de nós no DOM for instável, contar via estado derivado do store (nós passados ao `<ReactFlow>`) e registrar a decisão em `DECISIONS.md`.

---

## 13. Critérios de aceite

Usando o sistema de exemplo (seção 10):

| # | Dado / Quando | Então |
|---|---|---|
| A1 | Primeira execução com localStorage vazio | Sistema de exemplo é carregado e aberto automaticamente. |
| A2 | Visão macro (tudo colapsado) | **9 nós** visíveis e **9 arestas renderizadas**: usuario→akamai, akamai→portal-web, portal-web→apigee, apigee→sistema-pedidos, sistema-pedidos→ca-gateway, ca-gateway→sistema-validacao, sistema-validacao→rabbitmq (×2), rabbitmq→sistema-validacao (×2), sistema-validacao→sistema-externo. |
| A3 | Expandir `sistema-pedidos` a partir da macro | **13 nós** visíveis (o grupo expandido conta como nó contêiner) e **12 arestas renderizadas**; existem apigee→ingress-pedidos, ingress-pedidos→api-pedidos, api-pedidos→db-pedidos, db-pedidos→worker-pedidos, worker-pedidos→ca-gateway. |
| A4 | "Expandir tudo" | 27 nós visíveis (incluindo contêineres) e 21 arestas renderizadas (nenhuma agregada). |
| A5 | Nós `assumed` | `ingress-*` e `worker-pedidos` com borda tracejada; arestas assumed com "(?)". |
| A6 | Selecionar fluxo "Processamento assíncrono" na macro | 5 arestas destacadas com badges `2`, `3`, `6,10`, `8,12`, `14` (ver seção 12, `flowPath`); visão de expansão inalterada; botão "Expandir caminho" visível. |
| A7 | Clicar "Expandir caminho" | Expandidos exatamente `sistema-pedidos`, `db-pedidos`, `sistema-validacao`, `rabbitmq`; todas as 14 arestas do fluxo visíveis individualmente. |
| A8 | Passo a passo com `→` até o passo 6 | Aresta e13 enfatizada, painel mostra "Ramo A." e `routingKey: rk-a`. |
| A9 | Arrastar `apigee`, recarregar a página | Posição mantida. Exportar JSON contém `layout.positions.apigee`. |
| A10 | "Resetar layout" + confirmar | `layout.positions` vazio; layout automático reaplicado. |
| A11 | Editar `name` de `api-pedidos` para "API Orders" e salvar | Nome atualizado no canvas, persistido após reload e presente no JSON exportado. Campo `id` não editável. |
| A12 | Importar JSON com aresta apontando para nó inexistente | Nada importado; erro com path e id; "Copiar erros para a IA" copia texto no formato 6.2. |
| A13 | Importar exemplo novamente (mesmo id) e escolher "Substituir" | Posições salvas mantidas para ids existentes. "Importar como cópia" cria `exemplo-pedidos-copia`. |
| A14 | Colar JSON envolvido em ```` ```json ```` | Importa normalmente. |
| A15 | Buscar "worker" | Resultado "Sistema Pedidos › Worker Fila Pedidos"; selecionar expande ancestral, centraliza e destaca. |
| A16 | Filtrar `type = database` na macro | `sistema-pedidos` e `sistema-validacao` não esmaecidos (têm bancos descendentes); demais esmaecidos. |
| A17 | Aba "Evoluir sistema atual" | Prompt contém o JSON atual sem `layout`; "Copiar" copia o texto completo. |
| A18 | `npm run build:single` e abrir `sys-viz.html` via duplo clique, sem rede | App funciona: carrega exemplo, importa, exporta, persiste após reabrir. |
| A19 | `npm run build`, servir `dist/`, instalar como PWA no **Chrome/Edge**, desligar rede | App abre e funciona offline. (No Firefox, que tem suporte limitado à instalação de PWA, basta: recarregar a página offline após a primeira visita e o app funcionar.) |
| A20 | Exportar backup, limpar localStorage, recarregar (o exemplo é carregado automaticamente, A1), importar backup e escolher **Substituir todos** | Todos os sistemas restaurados com o conteúdo do backup. |
| A21 | `npm test`, `npm run typecheck`, `npm run lint` | Todos passam sem erros. |
| A22 | Aba "Mapear a partir de repositórios" | Prompt é o texto literal da §9.4 com JSON Schema e exemplo embutidos; "Copiar" copia o texto completo; funciona sem sistema aberto. |
| L1–L12 | Lógica de negócio | Critérios da §18.14. |

---

## 14. Ordem de implementação sugerida

1. Scaffold (Vite, TS, Tailwind, ESLint, Vitest) + scripts e os dois targets de build vazios funcionando.
2. `schema/` + `validate` + exemplo + testes.
3. `graph/` (tree, visibility, aggregate, flowPath, positions) + testes.
4. `storage/` + store Zustand + sidebar (lista, importar, exportar, backup).
5. Canvas: nós, grupos, arestas, expandir/colapsar, ELK, arrasto + persistência, reset.
6. Painel de detalhes + edição.
7. Fluxos (destaque, badges, expandir caminho, passo a passo).
8. Busca, filtros, legenda, níveis, tema.
9. Tela "Gerar com IA" + prompts.
10. PWA + HTML único + verificação dos critérios A1–A21.

---

## 15. Limitações conhecidas aceitas

- Posições arrastadas podem sobrepor nós após expandir/colapsar; mitigação: "Resetar layout".
- Estado de expansão não é exportado.
- localStorage de `file://` é separado do da versão hospedada (e no Chrome compartilhado entre arquivos locais).
- Limite de ~5 MB do localStorage.
- Posições salvas são relativas ao pai: se uma substituição mudar o pai de um nó, a posição preservada pode ficar sem sentido; mitigação: "Resetar layout".

---

## 16. Estilo de código

- **TypeScript** `strict: true`, mais `noUncheckedIndexedAccess: true`. Proibido `any` explícito (usar `unknown` + validação); `as` só com comentário justificando.
- **ESLint** (flat config, `eslint.config.js`): `@eslint/js` recommended, `typescript-eslint` recommended-type-checked, `eslint-plugin-react-hooks` (recommended), `eslint-plugin-react-refresh`, e `react/jsx-no-literals` (com `noStrings: true` e `ignoreProps: true`) para garantir que textos de UI venham de `src/i18n/pt-BR.ts` (11.4). Lint sem warnings (`--max-warnings 0`).
- **Prettier** com padrão do projeto: 2 espaços, aspas simples, ponto e vírgula, `printWidth: 100`, trailing commas. `npm run format` aplica; o lint não briga com o Prettier (`eslint-config-prettier`).
- **Nomes**: componentes React em `PascalCase.tsx` (um componente exportado por arquivo); módulos de lógica em `camelCase.ts`; testes ao lado do arquivo (`aggregate.test.ts`). Tipos e schemas: `SysNode` (tipo) e `SysNodeSchema` (Zod), com o tipo inferido via `z.infer`.
- **Funções puras** em `graph/`, `schema/`, `import/`: sem acesso a `window`, `localStorage` ou React; entrada e saída imutáveis (não mutar o `SystemDoc` recebido).
- **Componentes** só renderizam e despacham ações do store; nenhuma regra de negócio dentro de componente.
- **Erros esperados** (validação, storage) são retornados como valores (`{ ok: true, value } | { ok: false, errors }`), não lançados.
- Comentários e identificadores de código em inglês; textos de UI e mensagens de validação em pt-BR.

Exemplo do estilo esperado:

```ts
export function visibleAncestor(id: string, tree: TreeIndex, expanded: ReadonlySet<string>): string {
  // ancestors are ordered from root to parent; the first collapsed one hides everything below it
  for (const ancestor of tree.ancestorsOf(id)) {
    if (!expanded.has(ancestor)) return ancestor;
  }
  return id;
}
```

---

## 17. Limites para o agente implementador

**Sempre**

- Seguir a ordem da seção 14, uma etapa por vez, e ao fim de cada etapa rodar `npm test`, `npm run typecheck` e `npm run lint` com tudo passando.
- Escrever os testes da seção 12 junto com a lógica correspondente (não deixar para o fim).
- Registrar em `DECISIONS.md` toda escolha que esta spec não determina (data, decisão, motivo).
- Manter todos os textos de UI em `src/i18n/pt-BR.ts`.

**Perguntar antes**

- Adicionar dependência que não esteja na tabela da seção 2 (inclusive de desenvolvimento, exceto plugins de ESLint/Prettier citados na seção 16).
- Alterar o schema JSON (seção 4) ou os textos literais dos prompts (seção 9).
- Divergir de um requisito marcado como DEVE, mesmo que pareça melhor.

**Nunca**

- Fazer requisições de rede em runtime, carregar fontes/scripts externos ou incluir telemetria.
- Usar `dangerouslySetInnerHTML`, `eval` ou `new Function` com qualquer dado.
- Alterar o sistema de exemplo (seção 10) ou os critérios de aceite (seção 13) para fazer um teste passar.
- Desativar regras de lint, `strict` do TypeScript ou pular testes (`.skip`) para concluir uma etapa.
- Implementar operações estruturais (criar/excluir nós ou arestas), fora de escopo pela seção 1.2.

---

## 18. Lógica de negócio (v2)

> Extensão planejada. Implementar **depois** das etapas 1–10, seguindo a §18.11. Até lá, as seções 1–17 continuam valendo como estão; as alterações que esta seção exige nelas estão listadas na §18.10 e só devem ser aplicadas durante a implementação.

### 18.1 Objetivo

Responder **"o que acontece com esta requisição?"**: para cada ponto onde o sistema processa uma chamada ou mensagem, mostrar em fluxograma as validações, buscas de dados complementares, valores default, regras, decisões, gravações e processos engatilhados — e permitir seguir a requisição de um componente para o próximo.

### 18.2 Conceitos

- **Handler**: a lógica executada quando uma **aresta de entrada** chega ao seu nó de destino (um endpoint de API, uma mensagem consumida de uma fila, um registro lido por polling). Identificado pelo `id` da aresta. No máximo um handler por aresta. Passos de fluxo (§6.5) herdam a lógica automaticamente, pois referenciam arestas.
- **Passo (step)**: caixa do fluxograma, com uma **categoria** (§18.3).
- **Transição**: ligação dirigida entre dois passos do mesmo grafo; rotulada quando sai de um passo `decision` (ex.: "sim", "não", "aprovado").
- **Subprocesso**: grafo de lógica nomeado e reutilizável (ex.: "Calcula aprovação"), definido uma vez e referenciado por passos de qualquer handler ou de outro subprocesso.
- **Campo (field)**: dado de negócio usado por um passo, com papel `read`, `write` ou `validate`.
- **Texto em dois níveis**: `title`/`description` em linguagem de negócio (legível por analistas); `technical` e `metadata.source` com o detalhe técnico (classe/método, SQL, código de erro, `repositorio/caminho:linha`).

### 18.3 Categorias de passo

| `category`   | Uso                                                            | Ícone (lucide)            | Cor                                 |
| ------------ | -------------------------------------------------------------- | ------------------------- | ----------------------------------- |
| `start`      | Requisição ou mensagem chega (exatamente um por grafo)         | `LogIn`                   | neutra                              |
| `validation` | Validação de entrada ou de estado (ex.: CPF válido)            | `ShieldCheck`             | laranja                             |
| `fetch`      | Busca de dados complementares (banco, outra API, cache)        | `DatabaseZap`             | azul                                |
| `default`    | Valor padrão aplicado quando ausente                           | `SlidersHorizontal`       | neutra                              |
| `rule`       | Regra ou cálculo de negócio                                    | `Gavel`                   | violeta                             |
| `decision`   | Ponto de desvio; transições de saída rotuladas                 | `GitFork`                 | contorno tracejado, formato losango |
| `persist`    | Gravação/alteração de dados                                    | `DatabaseBackup`          | azul                                |
| `trigger`    | Processo engatilhado: publica mensagem, chama API, agenda job  | `Zap`                     | verde-água                          |
| `end`        | Término; `outcome` `success` (verde) ou `error` (vermelho)     | `CircleCheck` / `CircleX` | verde / vermelho                    |

Cores e ícones em `src/theme/stepCategories.ts`, com tokens para claro/escuro (mesmo padrão de `nodeTypes.ts`).

### 18.4 Schema (extensão do §4.1)

```ts
type SchemaVersion = 1 | 2; // v1 continua importável (§18.10); exportação sempre em v2

type StepCategory =
  | 'start'
  | 'validation'
  | 'fetch'
  | 'default'
  | 'rule'
  | 'decision'
  | 'persist'
  | 'trigger'
  | 'end';

interface LogicField {
  name: string; // ex.: "pedido.prazo" (notação livre, de preferência entidade.campo)
  role: 'read' | 'write' | 'validate';
  rule?: string; // regra em linguagem de negócio (ex.: "obrigatório", ">= 700")
  value?: string; // valor atribuído/default, sempre string (ex.: "30")
  errorCode?: string; // código de erro quando a validação falha (ex.: "CPF_INVALIDO")
}

interface LogicStep {
  id: string; // mesma regex de id; único entre TODOS os passos do documento
  category: StepCategory;
  title: string; // 1..80 chars, linguagem de negócio
  description?: string; // linguagem de negócio
  technical?: string; // detalhe técnico livre (classe.método, SQL, código de erro)
  edgeId?: string; // aresta do mapa usada pelo passo (fetch, persist, trigger)
  subprocessId?: string; // abre um subprocesso compartilhado
  outcome?: 'success' | 'error'; // só em `end`; exibição padrão: success
  fields?: LogicField[];
  metadata?: Record<string, string>; // inclui metadata.source = "repo/caminho:linha; ..."
  confidence?: Confidence;
}

interface LogicTransition {
  from: string; // id de passo do mesmo grafo
  to: string; // id de passo do mesmo grafo
  label?: string; // esperado quando `from` é decision (ver avisos)
}

interface LogicGraph {
  steps: LogicStep[]; // 1+
  transitions: LogicTransition[];
}

interface Handler extends LogicGraph {
  edgeId: string; // aresta de ENTRADA; o handler roda no nó `target` dela
  name?: string; // ex.: "POST /validacoes"; se ausente, exibir edge.label ou metadata.endpoint
  description?: string;
}

interface Subprocess extends LogicGraph {
  id: string; // mesma regex de id; único entre subprocessos
  name: string;
  description?: string;
}

interface SystemDoc {
  // ...campos do §4.1, com schemaVersion: 2
  logic?: {
    handlers?: Handler[];
    subprocesses?: Subprocess[];
  };
}
```

### 18.5 Validação (extensão do §4.2)

Erros:

1. Handler com `edgeId` inexistente, ou dois handlers para a mesma aresta.
2. `id` de passo duplicado (no documento inteiro); `id` de subprocesso duplicado.
3. Transição com `from`/`to` que não seja passo do mesmo grafo.
4. Passo com `edgeId` ou `subprocessId` inexistente.
5. Grafo sem exatamente um passo `start`.
6. `outcome` em passo que não é `end`.
7. Ciclo de subprocessos (A referencia B que referencia A, direta ou indiretamente).

Avisos:

1. Passo `decision` com menos de duas transições de saída, ou transição de saída de `decision` sem `label`.
2. Grafo sem nenhum passo `end`.
3. Passo inalcançável a partir do `start`.
4. Subprocesso não referenciado por nenhum passo.
5. Em um handler, passo com `edgeId` cuja aresta não sai do nó do handler (nem de um descendente dele).
6. Nó com pelo menos um handler cuja aresta de saída não é referenciada por nenhum passo de seus handlers (mensagem: `A aresta "e14" sai de "API Validação" mas não aparece em nenhuma lógica desse componente.`).

### 18.6 Visualização no mapa

- Aresta com handler: ícone `Workflow` ao lado do rótulo; no painel de detalhes da aresta, botão **"Abrir lógica"**.
- Nó com handlers: badge com o número de handlers (grupo colapsado soma os descendentes). O painel do nó lista os handlers (clicar abre a lógica).
- Painel de detalhes da aresta: seção **"Usada em"** listando os passos (handler › passo) que a referenciam via `edgeId`.
- Passo a passo do fluxo (§6.5): se a aresta do passo atual tem handler, botão **"Ver lógica"** na barra.

### 18.7 Tela de lógica (drill-down)

- Abrir uma lógica **substitui o canvas do mapa** pelo fluxograma (mesmo React Flow, outro conjunto de nós). A topbar mostra o **breadcrumb** (trilha) e o botão **"Voltar ao mapa"**. `Esc` volta um nível da trilha; no primeiro nível, volta ao mapa.
- **Trilha**: lista de níveis `{ kind: 'handler', edgeId } | { kind: 'subprocess', id, fromStepId }`. Rótulos: `<nome do nó> › <nome do handler> › <subprocesso> …`. Clicar num nível volta a ele. A trilha não é persistida.
- **Layout**: ELK `layered`, direção `DOWN`, sem posições salvas nem arrasto (somente leitura). Recalcular ao abrir cada nível.
- **Renderização dos passos**: cartão com ícone e cor da categoria (§18.3) e `title`; `decision` em losango (ou hexágono, se o texto não couber), com rótulos nas transições de saída; `end` verde/vermelho conforme `outcome`; `confidence: "assumed"` com borda tracejada. Chips no cartão:
  - `edgeId` → chip com o rótulo curto da aresta; clicar volta ao mapa, expande ancestrais e destaca a aresta (pulso de 2 s);
  - `subprocessId` → ícone de expandir; clicar (ou duplo clique no cartão) abre o subprocesso como novo nível da trilha;
  - `trigger` com `edgeId` → botão **"Seguir → <destino>"** (§18.8).
- **Filtro por categoria** (multiseleção, na topbar da tela de lógica): passos fora do filtro com opacidade 25%.
- **Painel de detalhes do passo**: seção **Negócio** (`title`, `description`, tabela de `fields`: nome, papel, regra, valor, código de erro); seção **Técnico** (`technical` e `metadata`, com `source` em fonte mono); seção **Ligações** (aresta, subprocesso). O painel de subprocesso mostra **"Usado em"** (handler › passo, clicável).
- **Edição** (mesma regra do §6.6): editáveis `title`, `description`, `technical`, `category`, `outcome` (só em `end`), `fields` (linhas com adicionar/remover), `metadata`, `confidence`; nome e descrição de handlers e subprocessos. Não editáveis: `id`, `edgeId`, `subprocessId` e transições. Nenhuma operação estrutural (criar/excluir passos, transições, handlers ou subprocessos).

### 18.8 Seguir a requisição

Ao clicar em "Seguir" num passo `trigger` com `edgeId = e`:

1. Se `e` tem handler → abrir esse handler.
2. Senão, se o destino de `e` é um nó de **passagem** (`type` em `exchange`, `queue`, `topic`, `broker`, `gateway`, `ingress`, `cdn`), percorrer suas arestas de saída (busca em largura, profundidade máxima 10, sem repetir aresta) até encontrar arestas com handler.
3. Se houver fluxo selecionado, preferir arestas que pertencem a ele.
4. Um resultado → abre direto. Vários → menu para escolher. Nenhum → botão desabilitado com o tooltip "Lógica de <destino> ainda não mapeada".

O handler aberto é **acrescentado** à trilha (o breadcrumb vira o caminho da requisição). Implementar como função pura `followTrigger(doc, edgeId, flowId?): string[]` (ids das arestas com handler) em `src/graph/followTrigger.ts`.

### 18.9 Busca por campo

A busca da topbar (§6.4) passa a ter dois grupos de resultado: **Componentes** (como hoje) e **Campos**. Em Campos, cada resultado mostra `field.name`, o papel, o `title` do passo e o caminho (`<nó> › <handler>` ou `Subprocesso <nome>`). Selecionar abre a lógica correspondente com o passo selecionado e destacado. Busca case/acento-insensitive sobre `fields[].name`.

### 18.10 Alterações em seções existentes (aplicar na implementação)

- **§4.1/§4.2/§4.5**: `schemaVersion` aceita `1 | 2`; a migração `1 → 2` apenas troca a versão (documentos v1 não têm `logic`). Exportação, backup e prompts usam v2. Arquivos com versão > 2 geram o erro de versão mais nova.
- **§9.1**: quarta aba **"Mapear lógica"**, habilitada só com sistema aberto, mostrando o prompt da §18.12 com o JSON atual embutido; instruções: "1. Abra um agente de IA com acesso aos repositórios. 2. Cole o prompt e diga qual fluxo ou endpoint mapear. 3. Confirme a lógica proposta. 4. Cole o JSON final em Importar."
- **§9.2 e §9.4 (texto literal)**: trocar `"schemaVersion" é 1` por `"schemaVersion" é 2` e acrescentar, após a linha `- Não inclua o campo "layout".`, a linha `- Não inclua o campo "logic"; a lógica de negócio é mapeada depois, com o prompt "Mapear lógica".`
- **§9.3 (texto literal)**: trocar `"schemaVersion": 1` por `"schemaVersion": 2` e acrescentar à seção "Regras obrigatórias" a linha `- Mantenha o campo "logic" como está. Se remover uma aresta ou nó, remova também os handlers e as referências (edgeId) que dependem dele, avisando o usuário.`
- **§10**: o exemplo v1 permanece intacto como fixture. Criar `src/examples/example-system-v2.json` = exemplo da §10 com `"schemaVersion": 2` e o campo `logic` da §18.13; é ele que a primeira execução carrega e que os prompts usam como `{{EXAMPLE_JSON}}`.
- **§13**: acrescentar os critérios L1–L12 (§18.14).

### 18.11 Ordem de implementação

11. Schema v2 (`logic`), migração, validação §18.5, exemplo v2 + testes.
12. Funções puras: índice de lógica (handlers por aresta, "usado em", contagem por nó), `followTrigger`, busca por campo + testes.
13. Indicadores no mapa (§18.6) e "Ver lógica" no passo a passo.
14. Tela de lógica: drill-down, trilha, layout ELK `DOWN`, renderização por categoria, filtro, painel e edição (§18.7).
15. "Seguir" (§18.8) e busca por campo (§18.9).
16. Aba "Mapear lógica" + ajustes nos prompts (§18.10) e verificação de L1–L12.

### 18.12 Prompt "Mapear lógica" (texto literal)

Placeholders: `{{JSON_SCHEMA}}` (schema v2) e `{{CURRENT_JSON}}` (documento atual sem `layout`).

````text
Você é um analista de sistemas ajudando a mapear a LÓGICA DE NEGÓCIO de um sistema na ferramenta "sys-viz". Você tem acesso aos repositórios do sistema. Abaixo está o documento JSON atual, que já descreve a arquitetura (nós, arestas e fluxos). Seu objetivo é descobrir no código o que acontece em cada ponto que processa uma requisição ou mensagem e devolver o documento COMPLETO com a seção "logic" preenchida ou ampliada.

## Escopo
- Fale no idioma do usuário.
- Pergunte primeiro o que mapear: um fluxo inteiro (campo "flows") ou handlers específicos. Um handler é a lógica executada quando uma aresta de ENTRADA chega ao seu nó de destino (um endpoint de API, uma mensagem consumida, um registro lido por polling) e é identificado pelo "id" dessa aresta.
- Para um fluxo, os handlers são as arestas do fluxo cujo destino executa código (api, worker, consumer, application, frontend, component). Ignore destinos de passagem (exchange, queue, topic, broker, gateway, ingress, cdn) e bancos.
- Não altere nada fora do escopo combinado.

## Como investigar
- Leia o código, não execute nada e não altere nenhum arquivo.
- Para cada handler, encontre o ponto de entrada (controller/action, handler de mensagem, loop do worker) e siga as chamadas por serviços e repositórios na ordem em que executam.
- Registre como passos apenas o que importa para o negócio: validações, buscas de dados complementares, valores default, regras e cálculos, decisões (if/switch que mudam o resultado), gravações, processos engatilhados (publicar mensagem, chamar API, agendar job) e os retornos de sucesso e erro. Ignore infraestrutura sem efeito de negócio (logs, injeção de dependência, mapeamentos triviais), a menos que o usuário peça.
- Quando um bloco de lógica for reutilizado por mais de um handler, ou tiver mais de 8 passos, transforme-o em subprocesso em "logic.subprocesses" e referencie-o com "subprocessId". Reutilize subprocessos existentes no documento em vez de criar versões parecidas.

## Categorias de passo ("category")
- start: a requisição ou mensagem chega (exatamente um por handler e por subprocesso).
- validation: valida entrada ou estado.
- fetch: busca dados complementares (banco, outra API, cache).
- default: aplica valor padrão quando o dado está ausente.
- rule: regra ou cálculo de negócio.
- decision: ponto de desvio; cada transição de saída tem "label" (ex.: "sim", "não", "aprovado").
- persist: grava ou altera dados.
- trigger: processo engatilhado (publica mensagem, chama outra API, agenda job).
- end: término, com "outcome" "success" ou "error" (ex.: retorno 200, 422 com código de erro, ack da mensagem).

## Regras de modelagem
- "title" e "description" em linguagem de negócio, legíveis por quem não conhece o código (ex.: "Valida se o cliente está ativo"). O detalhe técnico vai em "technical" (classe.método, operação SQL, tabela, código de erro HTTP e de negócio).
- Rastreabilidade: registre a evidência de cada passo em metadata.source no formato "repositorio/caminho:linha" (várias separadas por "; ").
- Passos fetch, persist e trigger devem apontar em "edgeId" para a aresta de SAÍDA do componente que representa aquela chamada. Se a chamada não existir no mapa, pergunte ao usuário e, com a confirmação dele, acrescente a aresta (e o nó, se preciso) seguindo as regras de modelagem do documento.
- "fields": liste os dados de negócio usados pelo passo quando o código deixar isso claro, com "name" (de preferência entidade.campo, ex.: "pedido.prazo"), "role" ("read", "write" ou "validate") e, quando houver, "rule" (em linguagem de negócio), "value" (sempre string) e "errorCode". Nunca inclua dados reais de clientes, senhas ou outros segredos.
- "confidence": "assumed" para o que foi inferido sem evidência clara no código.
- ids: minúsculos, kebab-case, únicos entre TODOS os passos do documento (use um prefixo por handler, ex.: "val-busca-pedido"). Subprocessos têm ids próprios (ex.: "sp-calcula-aprovacao").
- Transições ligam passos do mesmo handler ou subprocesso, na ordem de execução.

## Confirmação
Antes de gerar o JSON, apresente para cada handler (e subprocesso) um fluxograma em texto: passos numerados com categoria, título e evidência entre parênteses, e os desvios das decisões. Liste as dúvidas (no máximo 5 por mensagem): trechos que você não conseguiu seguir, decisões com regra pouco clara, chamadas sem aresta no mapa. Repita até não haver dúvidas que mudem o resultado e peça a confirmação do usuário.

## Regras obrigatórias
- NUNCA altere o "id" de nós, arestas, fluxos, handlers, passos ou subprocessos existentes.
- Mantenha intacto tudo o que está fora do escopo, inclusive handlers já mapeados (só os altere se o usuário pedir).
- Não inclua o campo "layout".

## Saída final
Após a confirmação, gere o documento COMPLETO (não um diff) com "schemaVersion": 2. Se você puder criar arquivos, salve-o como sysviz-<id-do-sistema>.json na raiz do workspace e informe o caminho; caso contrário, responda com UM ÚNICO bloco ```json. Antes de entregar, verifique: ids únicos, toda transição liga passos do mesmo grafo, todo "edgeId" e "subprocessId" existe, cada grafo tem exatamente um "start" e não há segredos no conteúdo.

Se o usuário colar uma lista de erros de validação do sys-viz, corrija e devolva o JSON completo novamente, mantendo os ids.

## JSON Schema
```json
{{JSON_SCHEMA}}
```

## Documento atual
```json
{{CURRENT_JSON}}
```

Comece resumindo em até 5 linhas os fluxos e componentes do documento atual e pergunte o que mapear.
````

### 18.13 Exemplo de lógica

Campo `logic` acrescentado ao exemplo da §10 (com `"schemaVersion": 2`) para formar `example-system-v2.json`. O conteúdo é ilustrativo.

```json
{
  "handlers": [
    {
      "edgeId": "e11",
      "name": "POST /validacoes",
      "description": "Valida o pedido e publica o resultado.",
      "steps": [
        { "id": "val-inicio", "category": "start", "title": "Requisição de validação chega" },
        {
          "id": "val-campos",
          "category": "validation",
          "title": "Valida campos obrigatórios",
          "technical": "ValidacaoRequestValidator (FluentValidation)",
          "fields": [
            { "name": "pedido.id", "role": "validate", "rule": "obrigatório", "errorCode": "CAMPOS_INVALIDOS" }
          ]
        },
        { "id": "val-campos-ok", "category": "decision", "title": "Dados válidos?" },
        {
          "id": "val-422",
          "category": "end",
          "outcome": "error",
          "title": "Retorna erro de validação",
          "technical": "HTTP 422 CAMPOS_INVALIDOS"
        },
        {
          "id": "val-busca-pedido",
          "category": "fetch",
          "title": "Busca dados do pedido e do cliente",
          "edgeId": "e12",
          "technical": "PedidoRepository.ObterPorId() — SELECT em tb_pedido",
          "fields": [
            { "name": "pedido.valor", "role": "read" },
            { "name": "cliente.score", "role": "read" }
          ]
        },
        {
          "id": "val-prazo",
          "category": "default",
          "title": "Sem prazo informado, usa 30 dias",
          "fields": [{ "name": "pedido.prazo", "role": "write", "rule": "quando nulo", "value": "30" }]
        },
        {
          "id": "val-aprovacao",
          "category": "rule",
          "title": "Calcula aprovação",
          "subprocessId": "sp-calcula-aprovacao"
        },
        { "id": "val-aprovado", "category": "decision", "title": "Pedido aprovado?" },
        { "id": "val-publica-aprovacao", "category": "trigger", "title": "Publica aprovação", "edgeId": "e13" },
        { "id": "val-publica-pendencia", "category": "trigger", "title": "Publica pendência", "edgeId": "e14" },
        {
          "id": "val-fim",
          "category": "end",
          "outcome": "success",
          "title": "Retorna aceito",
          "technical": "HTTP 202"
        }
      ],
      "transitions": [
        { "from": "val-inicio", "to": "val-campos" },
        { "from": "val-campos", "to": "val-campos-ok" },
        { "from": "val-campos-ok", "to": "val-422", "label": "não" },
        { "from": "val-campos-ok", "to": "val-busca-pedido", "label": "sim" },
        { "from": "val-busca-pedido", "to": "val-prazo" },
        { "from": "val-prazo", "to": "val-aprovacao" },
        { "from": "val-aprovacao", "to": "val-aprovado" },
        { "from": "val-aprovado", "to": "val-publica-aprovacao", "label": "sim" },
        { "from": "val-aprovado", "to": "val-publica-pendencia", "label": "não" },
        { "from": "val-publica-aprovacao", "to": "val-fim" },
        { "from": "val-publica-pendencia", "to": "val-fim" }
      ]
    },
    {
      "edgeId": "e17",
      "name": "Mensagem de aprovação (rk-a)",
      "steps": [
        { "id": "ca-inicio", "category": "start", "title": "Mensagem de aprovação chega" },
        {
          "id": "ca-grava",
          "category": "persist",
          "title": "Grava pedido como aprovado",
          "edgeId": "e19",
          "fields": [{ "name": "pedido.status", "role": "write", "value": "APROVADO" }]
        },
        {
          "id": "ca-fim",
          "category": "end",
          "outcome": "success",
          "title": "Confirma a mensagem",
          "technical": "BasicAck"
        }
      ],
      "transitions": [
        { "from": "ca-inicio", "to": "ca-grava" },
        { "from": "ca-grava", "to": "ca-fim" }
      ]
    }
  ],
  "subprocesses": [
    {
      "id": "sp-calcula-aprovacao",
      "name": "Calcula aprovação",
      "description": "Aprova pedidos de clientes com bom score e dentro do limite.",
      "steps": [
        { "id": "ap-inicio", "category": "start", "title": "Início" },
        {
          "id": "ap-score",
          "category": "decision",
          "title": "Score do cliente é suficiente?",
          "fields": [{ "name": "cliente.score", "role": "validate", "rule": ">= 700" }]
        },
        {
          "id": "ap-limite",
          "category": "decision",
          "title": "Valor dentro do limite?",
          "fields": [{ "name": "pedido.valor", "role": "validate", "rule": "<= limite de crédito do cliente" }]
        },
        { "id": "ap-aprovado", "category": "end", "outcome": "success", "title": "Aprovado" },
        { "id": "ap-pendente", "category": "end", "outcome": "success", "title": "Pendente de análise" }
      ],
      "transitions": [
        { "from": "ap-inicio", "to": "ap-score" },
        { "from": "ap-score", "to": "ap-limite", "label": "sim" },
        { "from": "ap-score", "to": "ap-pendente", "label": "não" },
        { "from": "ap-limite", "to": "ap-aprovado", "label": "sim" },
        { "from": "ap-limite", "to": "ap-pendente", "label": "não" }
      ]
    }
  ]
}
```

### 18.14 Critérios de aceite (lógica)

Usando `example-system-v2.json`:

| #   | Dado / Quando                                                                | Então                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | Importar o exemplo v1 (§10)                                                  | Importa sem erros; ao exportar, `schemaVersion` é 2 e não há `logic`.                                                                                                                       |
| L2  | Validar o exemplo v2                                                         | Nenhum erro e nenhum aviso.                                                                                                                                                                 |
| L3  | Mapa totalmente expandido                                                    | Arestas `e11` e `e17` com ícone de lógica; `api-validacao` e `consumer-a` com badge 1; na visão macro, `sistema-validacao` com badge 2.                                                      |
| L4  | Painel da aresta `e11` → "Abrir lógica"                                      | O canvas mostra 11 passos e 11 transições; breadcrumb `API Validação › POST /validacoes`; `val-campos-ok` em losango com saídas "sim"/"não".                                                 |
| L5  | Clicar no chip `e12` de `val-busca-pedido`                                   | Volta ao mapa com a aresta `e12` destacada e seus ancestrais expandidos.                                                                                                                    |
| L6  | Abrir `val-aprovacao`                                                        | Novo nível na trilha (`… › Calcula aprovação`) com 5 passos; o painel do subprocesso mostra "Usado em: POST /validacoes › Calcula aprovação". `Esc` volta ao handler.                       |
| L7  | "Seguir" em `val-publica-aprovacao`                                          | `followTrigger(doc, 'e13')` retorna `['e17']`; abre a lógica do Consumer A e a trilha vira `API Validação › POST /validacoes › Consumer A › Mensagem de aprovação (rk-a)`.                  |
| L8  | "Seguir" em `val-publica-pendencia`                                          | `followTrigger(doc, 'e14')` retorna `[]`; botão desabilitado com "Lógica de Consumer B ainda não mapeada".                                                                                  |
| L9  | Fluxo "Processamento assíncrono", passo 4 (`e11`) e passo 8 (`e17`)          | Botão "Ver lógica" visível nesses passos e ausente no passo 5 (`e12`).                                                                                                                      |
| L10 | Buscar "prazo"                                                               | O grupo Campos mostra `pedido.prazo` (write, `val-prazo`, `API Validação › POST /validacoes`); selecionar abre a lógica com `val-prazo` destacado.                                           |
| L11 | Filtro de categoria `trigger` na lógica de `e11`                             | Só `val-publica-aprovacao` e `val-publica-pendencia` sem esmaecer.                                                                                                                          |
| L12 | Editar o `title` de `val-prazo` e salvar                                     | Persistido após reload e no JSON exportado; `id`, `edgeId` e transições não editáveis.                                                                                                      |

### 18.15 Fora de escopo (lógica)

- Criar, excluir ou religar passos, transições, handlers ou subprocessos pela interface.
- Arrastar caixas ou salvar posições no fluxograma de lógica.
- Simular a execução com valores de entrada.
- Detectar automaticamente que a lógica ficou desatualizada em relação ao código.
- Comparar versões da lógica (diff).
