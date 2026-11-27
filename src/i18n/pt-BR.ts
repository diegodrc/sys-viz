// All user-facing text lives here (SPEC §11.4). Components must not contain string literals.

const q = (value: string): string => `"${value}"`;

const nodeCount = (n: number): string => (n === 1 ? '1 nó' : `${n} nós`);

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Formats an ISO timestamp for display; empty/invalid input yields an empty string. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return iso && !Number.isNaN(date.getTime()) ? dateTimeFormat.format(date) : '';
}

export const t = {
  app: {
    name: 'sys-viz',
    tagline: 'Visualizador de arquiteturas de sistemas',
  },
  common: {
    cancel: 'Cancelar',
    close: 'Fechar',
    save: 'Salvar',
    confirm: 'Confirmar',
    dismiss: 'Dispensar',
  },
  topbar: {
    toggleSidebar: 'Mostrar/ocultar lista de sistemas',
    systemMenu: 'Trocar de sistema',
    systemDetails: 'Detalhes do sistema',
    noSystem: 'Nenhum sistema aberto',
  },
  systems: {
    title: 'Sistemas',
    copySuffix: ' (cópia)',
    nodeCount,
    summary: (nodes: number, when: string) =>
      when ? `${nodeCount(nodes)} · alterado em ${when}` : nodeCount(nodes),
    open: (name: string) => `Abrir ${name}`,
    rename: 'Renomear',
    duplicate: 'Duplicar',
    exportJson: 'Exportar JSON',
    remove: 'Excluir',
    actionsFor: (name: string) => `Ações para ${name}`,
    renameTitle: 'Renomear sistema',
    nameLabel: 'Nome',
    nameRequired: 'O nome não pode ser vazio.',
    removeTitle: 'Excluir sistema',
    removeConfirm: (name: string) =>
      `Excluir o sistema ${q(name)}? Esta ação não pode ser desfeita.`,
    empty: 'Nenhum sistema salvo.',
    loadExample: 'Carregar exemplo',
    importButton: 'Importar',
    exportBackup: 'Exportar backup',
  },
  storage: {
    corrupted: (id: string) => `Sistema ${id} está corrompido`,
    downloadRaw: 'Baixar conteúdo bruto',
    removeCorrupted: 'Remover',
    quota:
      'Não há espaço no armazenamento do navegador. Exporte um backup e exclua sistemas para liberar espaço. A última alteração não foi salva.',
    writeFailed: (detail: string) => `Não foi possível salvar: ${detail}`,
    unavailable:
      'O armazenamento do navegador está indisponível; as alterações não serão mantidas após fechar a página.',
    openFailed: (id: string) => `Não foi possível abrir o sistema ${q(id)}.`,
  },
  importer: {
    title: 'Importar',
    fileLabel: 'Arquivo .json',
    pasteLabel: 'Ou cole o JSON (pode vir com cercas ```json)',
    submit: 'Importar',
    readFailed: 'Não foi possível ler o arquivo.',
    back: 'Voltar',
    errorsTitle: (n: number) => (n === 1 ? '1 erro encontrado' : `${n} erros encontrados`),
    nothingImported: 'Nada foi importado.',
    copyErrors: 'Copiar erros para a IA',
    copied: 'Copiado!',
    copyFailed: 'Não foi possível copiar.',
    rootPath: '(documento)',
    aiErrorsHeader:
      'O JSON que você gerou para o sys-viz tem os erros abaixo. Corrija-os e devolva o JSON COMPLETO, mantendo todos os ids existentes.',
    conflictTitle: 'Sistema já existe',
    conflictMessage: (id: string, name: string) =>
      `Já existe um sistema com o id ${q(id)} (${name}).`,
    replace: 'Substituir',
    importAsCopy: 'Importar como cópia',
    warningsTitle: (n: number) => (n === 1 ? 'Importado com 1 aviso' : `Importado com ${n} avisos`),
    imported: (name: string) => `${q(name)} importado.`,
    backupInvalidTitle: (n: number) =>
      n === 1 ? '1 sistema do backup tem erros' : `${n} sistemas do backup têm erros`,
    backupInvalidItem: (position: number, id: string | undefined) =>
      id ? `Sistema ${position} (${q(id)})` : `Sistema ${position}`,
    importValidOnly: (n: number) =>
      n === 1 ? 'Importar o sistema válido' : `Importar os ${n} sistemas válidos`,
    backupNoneValid: 'Nenhum sistema válido no backup.',
    backupConflictTitle: 'Sistemas já existentes',
    backupConflictMessage: (ids: readonly string[]) =>
      `Estes sistemas já existem: ${ids.map(q).join(', ')}.`,
    replaceAll: 'Substituir todos',
    skipExisting: 'Pular existentes',
    importAsCopies: 'Importar como cópias',
    backupImported: (n: number) =>
      n === 1 ? '1 sistema importado do backup.' : `${n} sistemas importados do backup.`,
  },
  backup: {
    newerVersion: (version: number) =>
      `Este backup foi gerado por uma versão mais nova do sys-viz (sysvizBackup ${version}).`,
    invalidVersion: 'Backup inválido: "sysvizBackup" deve ser 1.',
    missingSystems: 'Backup inválido: "systems" deve ser uma lista.',
    duplicateSystemId: (id: string) =>
      `O id de sistema ${q(id)} aparece mais de uma vez no backup.`,
  },
  canvas: {
    label: 'Diagrama do sistema',
    computingLayout: 'Calculando layout…',
    layoutFailed: 'Não foi possível calcular o layout do diagrama.',
    assumedNode: 'Camada presumida — não confirmada',
    descendants: (n: number) => `+${n}`,
    descendantsTitle: (n: number) => (n === 1 ? '1 item dentro' : `${n} itens dentro`),
    expand: (name: string) => `Expandir ${name}`,
    collapse: (name: string) => `Colapsar ${name}`,
    aggregatedLabel: (n: number) => `×${n}`,
    assumedSuffix: '(?)',
    edgeLine: (label: string, source: string, target: string) =>
      label ? `${label}: ${source} → ${target}` : `${source} → ${target}`,
    noSystem: 'Nenhum sistema aberto. Escolha ou importe um sistema na lista.',
  },
  edit: {
    emptyKey: 'A chave não pode ser vazia.',
    duplicateKey: (key: string) => `A chave ${q(key)} está repetida.`,
    forbiddenKey: (key: string) => `A chave ${q(key)} não é permitida.`,
    invalidForm: 'Corrija os campos destacados para salvar.',
  },
  details: {
    panel: 'Painel de detalhes',
    close: 'Fechar painel de detalhes',
    edit: 'Editar',
    copyId: 'Copiar id',
    idCopied: 'Id copiado.',
    empty: '—',
    kinds: {
      node: 'Nó',
      edge: 'Aresta',
      aggregated: (n: number) => `Aresta agregada (${n} originais)`,
      flow: 'Fluxo',
      system: 'Sistema',
    },
    fields: {
      id: 'Id',
      name: 'Nome',
      type: 'Tipo',
      description: 'Descrição',
      technology: 'Tecnologia',
      hosting: 'Hospedagem',
      platform: 'Plataforma',
      cluster: 'Cluster',
      namespace: 'Namespace',
      hostingDetails: 'Detalhes da hospedagem',
      owner: 'Time responsável',
      links: 'Links',
      linkLabel: 'Rótulo',
      linkUrl: 'URL',
      metadata: 'Metadata',
      metadataKey: 'Chave',
      metadataValue: 'Valor',
      confidence: 'Confiança',
      children: 'Filhos',
      incoming: 'Conexões de entrada',
      outgoing: 'Conexões de saída',
      source: 'Origem',
      target: 'Destino',
      protocol: 'Protocolo',
      mode: 'Modo',
      label: 'Rótulo',
      steps: 'Passos',
      originals: 'Arestas originais',
      schemaVersion: 'Versão do schema',
    },
    confidence: {
      confirmed: 'Confirmado',
      assumed: 'Presumido',
    },
    modes: {
      unset: 'Não definido (síncrono)',
      sync: 'Síncrono',
      async: 'Assíncrono',
    },
    platforms: {
      none: 'Nenhum',
      kubernetes: 'Kubernetes',
      vm: 'VM',
      serverless: 'Serverless',
      paas: 'PaaS',
      saas: 'SaaS',
      'on-premise': 'On-premise',
      other: 'Outro',
    },
    addLink: 'Adicionar link',
    addMetadata: 'Adicionar item',
    removeRow: 'Remover linha',
    noItems: 'Nenhum.',
    edgeSummary: (label: string, source: string, target: string) =>
      label ? `${source} → ${target} (${label})` : `${source} → ${target}`,
    stepItem: (n: number, edge: string) => `${n}. ${edge}`,
  },
  flows: {
    selector: 'Fluxo',
    none: 'Nenhum',
    expandPath: 'Expandir caminho',
    details: 'Detalhes do fluxo',
    bar: 'Passo a passo do fluxo',
    previous: 'Anterior',
    next: 'Próximo',
    close: 'Fechar fluxo',
    notStarted: (name: string, total: number) =>
      `${name}: ${total === 1 ? '1 passo' : `${total} passos`}. Use Próximo ou → para começar.`,
    stepOf: (n: number, total: number, text: string) =>
      text ? `Passo ${n} de ${total}: ${text}` : `Passo ${n} de ${total}`,
    hiddenStep: (name: string) => `Este passo está dentro de ${name}.`,
    reveal: 'Expandir',
  },
  logic: {
    open: 'Abrir lógica',
    viewLogic: 'Ver lógica',
    hasLogic: 'Tem lógica de negócio mapeada',
    handlersBadge: (n: number) => (n === 1 ? '1 lógica mapeada' : `${n} lógicas mapeadas`),
    handlersTitle: 'Lógicas mapeadas',
    usedIn: 'Usada em',
    usedInSubprocess: 'Usado em',
    noUsages: 'Nenhum passo de lógica usa esta aresta.',
    backToMap: 'Voltar ao mapa',
    trail: 'Trilha da requisição',
    canvasLabel: 'Fluxograma da lógica',
    computingLayout: 'Calculando layout da lógica…',
    subprocessTrail: (name: string) => `Subprocesso ${name}`,
    usageItem: (place: string, step: string) => `${place} › ${step}`,
    categories: {
      start: 'Início',
      validation: 'Validação',
      fetch: 'Busca de dados',
      default: 'Valor padrão',
      rule: 'Regra',
      decision: 'Decisão',
      persist: 'Gravação',
      trigger: 'Gatilho',
      end: 'Fim',
    },
    outcomes: { success: 'Sucesso', error: 'Erro' },
    roles: { read: 'lê', write: 'grava', validate: 'valida' },
    filter: 'Categorias',
    filterTitle: 'Filtrar passos por categoria',
    clearFilter: 'Limpar categorias',
    follow: (destination: string) => `Seguir → ${destination}`,
    followChoose: 'Seguir para…',
    followNone: (destination: string) => `Lógica de ${destination} ainda não mapeada`,
    followNothing: 'Nenhuma lógica alcançável a partir desta aresta',
    openSubprocess: (name: string) => `Abrir subprocesso ${name}`,
    showEdge: (label: string) => `Ver aresta ${label} no mapa`,
    kinds: { step: 'Passo da lógica', handler: 'Lógica', subprocess: 'Subprocesso' },
    sections: { business: 'Negócio', technical: 'Técnico', links: 'Ligações' },
    fields: {
      title: 'Título',
      category: 'Categoria',
      outcome: 'Resultado',
      technical: 'Detalhe técnico',
      fields: 'Campos',
      fieldName: 'Campo',
      fieldRole: 'Papel',
      fieldRule: 'Regra',
      fieldValue: 'Valor',
      fieldError: 'Código de erro',
      edge: 'Aresta',
      subprocess: 'Subprocesso',
      handlerEdge: 'Aresta de entrada',
      node: 'Componente',
    },
    addField: 'Adicionar campo',
    removeField: (n: number) => `Remover campo ${n}`,
    edit: {
      emptyFieldName: 'O nome do campo não pode ser vazio.',
      invalidLogic: (message: string) => `A alteração deixaria a lógica inválida: ${message}`,
    },
  },
  search: {
    label: 'Buscar nó ou campo (atalho /)',
    placeholder: 'Buscar… ( / )',
    results: 'Resultados da busca',
    noResults: 'Nenhum nó ou campo encontrado.',
    pathSeparator: ' › ',
    groupComponents: 'Componentes',
    groupFields: 'Campos',
    fieldResult: (name: string, role: string, step: string) => `${name} (${role}) — ${step}`,
  },
  filters: {
    button: 'Filtros',
    active: (n: number) => (n === 1 ? '1 filtro ativo' : `${n} filtros ativos`),
    types: 'Tipo',
    platforms: 'Hospedagem',
    noHosting: 'sem hosting',
    clear: 'Limpar filtros',
    clearTitle: (n: number) => `${n === 1 ? '1 filtro ativo' : `${n} filtros ativos`} — limpar`,
  },
  levels: {
    button: 'Níveis',
    expandAll: 'Expandir tudo',
    collapseAll: 'Colapsar tudo',
    expandTo: (n: number) => `Expandir até nível ${n}`,
  },
  legend: {
    button: 'Legenda',
    nodeTypes: 'Tipos de nó',
    edges: 'Arestas',
    sync: 'Síncrona',
    async: 'Assíncrona',
    assumed: 'Presumida (?)',
    aggregated: 'Agregada (×N)',
  },
  theme: {
    button: (current: string) => `Tema: ${current}. Clique para trocar`,
    light: 'claro',
    dark: 'escuro',
    system: 'sistema',
  },
  ai: {
    button: 'Gerar com IA',
    title: 'Gerar com IA',
    tabCreate: 'Criar novo sistema',
    tabRepos: 'Mapear a partir de repositórios',
    tabEvolve: 'Evoluir sistema atual',
    tabLogic: 'Mapear lógica',
    evolveDisabled: 'Abra um sistema para gerar este prompt.',
    promptLabel: 'Prompt para o agente de IA',
    copy: 'Copiar prompt',
    copied: 'Prompt copiado!',
    copyFailed: 'Não foi possível copiar. Selecione o texto e copie manualmente.',
    instructions:
      '1. Copie o prompt. 2. Cole em um agente de IA (ChatGPT, Claude, Copilot…). 3. Responda às perguntas. 4. Cole o JSON final em Importar.',
    instructionsRepos:
      '1. Abra um agente de IA com acesso aos repositórios do fluxo (Claude Code, Copilot, Cursor…). 2. Cole o prompt e descreva o fluxo passo a passo. 3. Confirme o inventário e responda às perguntas. 4. Cole o JSON final em Importar.',
    instructionsLogic:
      '1. Abra um agente de IA com acesso aos repositórios. 2. Cole o prompt e diga qual fluxo ou endpoint mapear. 3. Confirme a lógica proposta. 4. Cole o JSON final em Importar.',
    importJson: 'Importar JSON',
  },
  about: {
    button: 'Sobre/Ajuda',
    title: 'Sobre o sys-viz',
    intro:
      'O sys-viz visualiza arquiteturas de sistemas descritas em JSON, com nós aninhados, agregação de arestas e fluxos passo a passo. Tudo roda no navegador, sem servidor e sem acesso à rede; os dados ficam no armazenamento local deste navegador.',
    fileNote:
      'No HTML único aberto via file://, o localStorage é separado da versão hospedada; para mover dados use exportar/importar backup.',
    shortcutsTitle: 'Atalhos',
    shortcuts: [
      '/ — buscar nó',
      '← / → — passo anterior / próximo do fluxo',
      'Esc — tirar o foco do campo, limpar a seleção, fechar painéis e diálogos',
      'Duplo clique em um grupo — expandir/colapsar',
    ],
  },
  layout: {
    reset: 'Resetar layout',
    resetTitle: 'Resetar layout',
    resetConfirm:
      'Apagar todas as posições arrastadas deste sistema e recalcular o layout automático?',
  },
  nodeTypes: {
    system: 'sistema',
    application: 'aplicação',
    frontend: 'frontend',
    api: 'API',
    worker: 'worker',
    consumer: 'consumer',
    component: 'componente',
    cdn: 'CDN',
    gateway: 'gateway',
    ingress: 'ingress',
    broker: 'broker',
    exchange: 'exchange',
    queue: 'fila',
    topic: 'tópico',
    database: 'banco de dados',
    table: 'tabela',
    cache: 'cache',
    storage: 'storage',
    external: 'externo',
    user: 'usuário',
    other: 'outro',
  },
  hosting: {
    short: {
      kubernetes: 'k8s',
      vm: 'VM',
      serverless: 'serverless',
      paas: 'PaaS',
      saas: 'SaaS',
      'on-premise': 'on-prem',
      other: 'outro',
    },
    title: (platform: string) => `Hospedagem: ${platform}`,
  },
  errorBoundary: {
    title: 'Algo deu errado ao exibir este sistema.',
    back: 'Voltar à lista de sistemas',
  },
  validation: {
    // errors (SPEC §4.2)
    tooLarge: (maxMb: number) => `O texto tem mais de ${maxMb} MB e não pode ser importado.`,
    invalidJson: (detail: string) => `JSON inválido: ${detail}`,
    invalidJsonAt: (line: number, column: number, detail: string) =>
      `JSON inválido na linha ${line}, coluna ${column}: ${detail}`,
    notAnObject: 'O documento deve ser um objeto JSON.',
    tooDeep: (max: number, id: string | undefined) =>
      `A hierarquia de "children" passa de ${max} níveis${id ? ` (no nó ${q(id)})` : ''}.`,
    tooManyNodes: (max: number) => `O documento tem mais de ${max} nós.`,
    forbiddenMetadataKey: (key: string, ownerId: string | undefined) =>
      `A chave de metadata ${q(key)} não é permitida${ownerId ? ` (em ${q(ownerId)})` : ''}.`,
    newerVersion: (version: number) =>
      `Este arquivo foi gerado por uma versão mais nova do sys-viz (schemaVersion ${version}).`,
    duplicateNodeId: (id: string) => `O id de nó ${q(id)} está duplicado.`,
    duplicateEdgeId: (id: string) => `O id de aresta ${q(id)} está duplicado.`,
    duplicateFlowId: (id: string) => `O id de fluxo ${q(id)} está duplicado.`,
    missingEdgeEnd: (edgeId: string, nodeId: string) =>
      `A aresta ${q(edgeId)} aponta para o nó inexistente ${q(nodeId)}.`,
    selfEdge: (edgeId: string, nodeId: string) =>
      `A aresta ${q(edgeId)} liga o nó ${q(nodeId)} a ele mesmo.`,
    ancestorEdge: (edgeId: string, ancestorId: string, descendantId: string) =>
      `A aresta ${q(edgeId)} liga ${q(ancestorId)} ao seu descendente ${q(descendantId)}.`,
    missingFlowEdge: (flowId: string, step: number, edgeId: string) =>
      `O passo ${step} do fluxo ${q(flowId)} referencia a aresta inexistente ${q(edgeId)}.`,
    // business logic (SPEC §18.5)
    logic: {
      handlerLabel: (edgeId: string) => `o handler da aresta ${q(edgeId)}`,
      subprocessLabel: (id: string) => `o subprocesso ${q(id)}`,
      missingHandlerEdge: (edgeId: string) =>
        `Um handler referencia a aresta inexistente ${q(edgeId)}.`,
      duplicateHandler: (edgeId: string) => `A aresta ${q(edgeId)} tem mais de um handler.`,
      duplicateStep: (id: string) => `O id de passo ${q(id)} está duplicado.`,
      duplicateSubprocess: (id: string) => `O id de subprocesso ${q(id)} está duplicado.`,
      badTransition: (graph: string, from: string, to: string) =>
        `Uma transição em ${graph} liga ${q(from)} a ${q(to)}, que não são passos desse grafo.`,
      missingStepEdge: (stepId: string, edgeId: string) =>
        `O passo ${q(stepId)} referencia a aresta inexistente ${q(edgeId)}.`,
      missingSubprocess: (stepId: string, id: string) =>
        `O passo ${q(stepId)} referencia o subprocesso inexistente ${q(id)}.`,
      startCount: (graph: string, n: number) =>
        `Deve haver exatamente um passo "start" em ${graph} (há ${n}).`,
      outcomeNotEnd: (stepId: string) =>
        `O passo ${q(stepId)} tem "outcome", mas só passos "end" podem ter.`,
      subprocessCycle: (ids: readonly string[]) =>
        `Os subprocessos formam um ciclo: ${ids.map(q).join(' → ')}.`,
      decisionExits: (stepId: string) => `A decisão ${q(stepId)} tem menos de duas saídas.`,
      decisionLabel: (stepId: string, to: string) =>
        `A saída da decisão ${q(stepId)} para ${q(to)} não tem rótulo.`,
      noEnd: (graph: string) => `Não há nenhum passo "end" em ${graph}.`,
      unreachable: (stepId: string, graph: string) =>
        `O passo ${q(stepId)} não é alcançável a partir do início em ${graph}.`,
      unusedSubprocess: (id: string) => `O subprocesso ${q(id)} não é usado por nenhum passo.`,
      stepEdgeElsewhere: (stepId: string, edgeId: string, node: string) =>
        `O passo ${q(stepId)} usa a aresta ${q(edgeId)}, que não sai de ${q(node)}.`,
      edgeNotInLogic: (edgeId: string, node: string) =>
        `A aresta ${q(edgeId)} sai de ${q(node)} mas não aparece em nenhuma lógica desse componente.`,
    },
    // schema (Zod) errors
    schema: {
      required: 'Campo obrigatório ausente.',
      wrongType: (expected: string) => `Tipo inválido; esperado: ${expected}.`,
      invalidValue: (allowed: string) => `Valor inválido; valores aceitos: ${allowed}.`,
      invalidId:
        'Id inválido: use letras minúsculas, números e "-", começando por letra ou número.',
      tooShortString: (min: number) =>
        min <= 1 ? 'O texto não pode ser vazio.' : `O texto deve ter ao menos ${min} caracteres.`,
      tooLongString: (max: number) => `O texto deve ter no máximo ${max} caracteres.`,
      tooFewItems: (min: number) => `A lista deve ter ao menos ${min} item(ns).`,
      tooManyItems: (max: number) => `A lista deve ter no máximo ${max} item(ns).`,
      generic: 'Valor inválido.',
      withId: (message: string, id: string) => `${message} (em ${q(id)})`,
    },
    // warnings (SPEC §4.2)
    disconnectedStep: (flowId: string, step: number, edgeId: string, sourceId: string) =>
      `O passo ${step} do fluxo ${q(flowId)} (aresta ${q(edgeId)}) parte de ${q(sourceId)}, que não aparece nos passos anteriores.`,
    unknownPosition: (nodeId: string) =>
      `Posição salva para o nó inexistente ${q(nodeId)} foi descartada.`,
    isolatedRoot: (nodeId: string) =>
      `O nó raiz ${q(nodeId)} não participa de nenhuma aresta (nem seus descendentes).`,
    unknownField: (path: string) => `Campo desconhecido ${q(path)} foi descartado.`,
  },
} as const;
