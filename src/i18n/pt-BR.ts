// All user-facing text lives here (SPEC §11.4). Components must not contain string literals.

const q = (value: string): string => `"${value}"`;

export const t = {
  app: {
    name: 'sys-viz',
    tagline: 'Visualizador de arquiteturas de sistemas',
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
