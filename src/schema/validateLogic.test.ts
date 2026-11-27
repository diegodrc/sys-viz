import { describe, expect, it } from 'vitest';
import specRaw from '../../SPEC.md?raw';
import exampleV1 from '../examples/example-system.json';
import exampleV2 from '../examples/example-system-v2.json';
import { exampleDoc } from '../test/fixtures';
import type { Issue } from './result';
import type { SystemDoc } from './system';
import { subprocessCycle } from './validateLogic';
import { validateSystemDoc } from './validate';

const spec = specRaw.replace(/\r\n/g, '\n');

function jsonBlockAfter(heading: string): unknown {
  const start = spec.indexOf(heading);
  const open = spec.indexOf('```json\n{', start);
  const close = spec.indexOf('\n```', open + 8);
  return JSON.parse(spec.slice(open + '```json\n'.length, close)) as unknown;
}

function errorsOf(doc: unknown): Issue[] {
  const result = validateSystemDoc(doc);
  return result.ok ? [] : result.errors;
}

function warningsOf(doc: unknown): Issue[] {
  const result = validateSystemDoc(doc);
  if (!result.ok) throw new Error(`unexpected errors: ${JSON.stringify(result.errors)}`);
  return result.warnings;
}

/** The example with a mutation applied to a deep copy. */
function mutated(change: (doc: SystemDoc) => void): SystemDoc {
  const doc = exampleDoc();
  change(doc);
  return doc;
}

const handler = (doc: SystemDoc, edgeId: string) => {
  const found = doc.logic?.handlers?.find((h) => h.edgeId === edgeId);
  if (!found) throw new Error(`no handler ${edgeId}`);
  return found;
};

const subprocess = (doc: SystemDoc) => {
  const found = doc.logic?.subprocesses?.[0];
  if (!found) throw new Error('no subprocess');
  return found;
};

describe('example v2 (SPEC §18.10, §18.13)', () => {
  it('is the §10 example plus schemaVersion 2 and the §18.13 logic', () => {
    expect(exampleV2).toEqual({
      ...exampleV1,
      schemaVersion: 2,
      logic: jsonBlockAfter('### 18.13 Exemplo de lógica'),
    });
  });

  it('L2: validates with no errors and no warnings', () => {
    const result = validateSystemDoc(structuredClone(exampleV2));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toEqual([]);
  });

  it('L1: a v1 document is migrated to v2 without logic', () => {
    const result = validateSystemDoc(structuredClone(exampleV1));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schemaVersion).toBe(2);
      expect(result.value.logic).toBeUndefined();
    }
  });
});

describe('logic errors (SPEC §18.5)', () => {
  it('1. handler on a missing edge, or two handlers on one edge', () => {
    const missing = errorsOf(mutated((d) => (handler(d, 'e17').edgeId = 'e99')));
    expect(missing).toHaveLength(1);
    expect(missing[0]?.path).toBe('logic.handlers[1].edgeId');
    expect(missing[0]?.message).toContain('"e99"');

    const duplicate = errorsOf(mutated((d) => (handler(d, 'e17').edgeId = 'e11')));
    expect(duplicate.map((e) => e.message)).toContain('A aresta "e11" tem mais de um handler.');
  });

  it('2. duplicate step ids (across graphs) and subprocess ids', () => {
    const steps = errorsOf(mutated((d) => (handler(d, 'e17').steps[1]!.id = 'val-prazo')));
    expect(steps.map((e) => e.message)).toContain('O id de passo "val-prazo" está duplicado.');

    const subs = errorsOf(
      mutated((d) => d.logic?.subprocesses?.push(structuredClone(subprocess(d)))),
    );
    expect(subs.map((e) => e.message)).toContain(
      'O id de subprocesso "sp-calcula-aprovacao" está duplicado.',
    );
  });

  it('3. transitions must join steps of the same graph', () => {
    const errors = errorsOf(
      mutated((d) => handler(d, 'e17').transitions.push({ from: 'ca-grava', to: 'val-fim' })),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe('logic.handlers[1].transitions[2]');
  });

  it('4. step references to missing edges and subprocesses', () => {
    const edge = errorsOf(mutated((d) => (handler(d, 'e11').steps[4]!.edgeId = 'e99')));
    expect(edge[0]?.message).toBe(
      'O passo "val-busca-pedido" referencia a aresta inexistente "e99".',
    );
    const sub = errorsOf(mutated((d) => (handler(d, 'e11').steps[6]!.subprocessId = 'sp-x')));
    expect(sub[0]?.path).toBe('logic.handlers[0].steps[6].subprocessId');
  });

  it('5. exactly one start per graph', () => {
    const none = errorsOf(mutated((d) => (handler(d, 'e17').steps[0]!.category = 'rule')));
    expect(none[0]?.message).toContain('(há 0)');
    const two = errorsOf(mutated((d) => (subprocess(d).steps[1]!.category = 'start')));
    expect(two[0]?.message).toContain('o subprocesso "sp-calcula-aprovacao" (há 2)');
  });

  it('6. outcome only on end steps', () => {
    const errors = errorsOf(mutated((d) => (handler(d, 'e11').steps[1]!.outcome = 'error')));
    expect(errors[0]?.path).toBe('logic.handlers[0].steps[1].outcome');
  });

  it('7. subprocess cycles', () => {
    const doc = mutated((d) => {
      const sp = subprocess(d);
      d.logic?.subprocesses?.push({
        id: 'sp-b',
        name: 'B',
        steps: [{ id: 'b-inicio', category: 'start', title: 'B', subprocessId: sp.id }],
        transitions: [],
      });
      sp.steps[1]!.subprocessId = 'sp-b';
    });
    expect(subprocessCycle(doc)).toEqual(['sp-calcula-aprovacao', 'sp-b', 'sp-calcula-aprovacao']);
    expect(errorsOf(doc).map((e) => e.message)).toContain(
      'Os subprocessos formam um ciclo: "sp-calcula-aprovacao" → "sp-b" → "sp-calcula-aprovacao".',
    );
  });

  it('rejects forbidden metadata keys in steps before parsing', () => {
    const raw = structuredClone(exampleV2) as { logic: { handlers: { steps: object[] }[] } };
    raw.logic.handlers[0]!.steps[0] = {
      ...raw.logic.handlers[0]!.steps[0],
      metadata: JSON.parse('{"__proto__":"x"}') as object,
    };
    expect(errorsOf(raw)[0]?.path).toBe('logic.handlers[0].steps[0].metadata.__proto__');
  });
});

describe('logic warnings (SPEC §18.5)', () => {
  it('1. decisions need two labelled exits', () => {
    const fewer = warningsOf(
      mutated((d) => {
        const h = handler(d, 'e11');
        h.transitions = h.transitions.filter((tr) => tr.to !== 'val-422');
        h.steps = h.steps.filter((s) => s.id !== 'val-422');
      }),
    );
    expect(fewer.map((w) => w.message)).toContain(
      'A decisão "val-campos-ok" tem menos de duas saídas.',
    );

    const unlabelled = warningsOf(mutated((d) => delete handler(d, 'e11').transitions[2]!.label));
    expect(unlabelled.map((w) => w.message)).toContain(
      'A saída da decisão "val-campos-ok" para "val-422" não tem rótulo.',
    );
  });

  it('2. graph without end', () => {
    const warnings = warningsOf(
      mutated((d) => {
        const h = handler(d, 'e17');
        h.steps = h.steps.filter((s) => s.id !== 'ca-fim');
        h.transitions = h.transitions.filter((tr) => tr.to !== 'ca-fim');
      }),
    );
    expect(warnings.map((w) => w.message)).toEqual([
      'Não há nenhum passo "end" em o handler da aresta "e17".',
    ]);
  });

  it('3. unreachable steps', () => {
    const warnings = warningsOf(
      mutated((d) => {
        const h = handler(d, 'e17');
        h.transitions = h.transitions.filter((tr) => tr.from !== 'ca-inicio');
      }),
    );
    expect(warnings.map((w) => w.path)).toEqual([
      'logic.handlers[1].steps[1]',
      'logic.handlers[1].steps[2]',
    ]);
  });

  it('4. unused subprocess', () => {
    const warnings = warningsOf(mutated((d) => delete handler(d, 'e11').steps[6]!.subprocessId));
    expect(warnings.map((w) => w.message)).toEqual([
      'O subprocesso "sp-calcula-aprovacao" não é usado por nenhum passo.',
    ]);
  });

  it('5. handler step using an edge that does not leave the handler node', () => {
    const warnings = warningsOf(mutated((d) => (handler(d, 'e17').steps[1]!.edgeId = 'e20')));
    expect(warnings.map((w) => w.message)).toContain(
      'O passo "ca-grava" usa a aresta "e20", que não sai de "Consumer A".',
    );
  });

  it('6. outgoing edge of a node with handlers missing from its logic', () => {
    const warnings = warningsOf(mutated((d) => delete handler(d, 'e11').steps[9]!.edgeId));
    expect(warnings.map((w) => w.message)).toEqual([
      'A aresta "e14" sai de "API Validação" mas não aparece em nenhuma lógica desse componente.',
    ]);
  });
});
