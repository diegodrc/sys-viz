import { describe, expect, it } from 'vitest';
import example from '../examples/example-system.json';
import type { Issue } from './result';
import type { SysNode, SystemDoc } from './system';
import {
  LIMITS,
  parseJsonText,
  validateSystemDoc,
  validateSystemText,
  type ValidationResult,
} from './validate';

function exampleDoc(): SystemDoc {
  return structuredClone(example) as SystemDoc;
}

function minimalDoc(overrides: Partial<SystemDoc> = {}): SystemDoc {
  return {
    schemaVersion: 2,
    id: 'mini',
    name: 'Mini',
    nodes: [
      { id: 'a', name: 'A', type: 'api' },
      { id: 'b', name: 'B', type: 'database' },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b' }],
    ...overrides,
  };
}

function errorsOf(result: ValidationResult): Issue[] {
  if (result.ok) throw new Error('expected validation to fail');
  return result.errors;
}

function warningsOf(result: ValidationResult): Issue[] {
  if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.errors)}`);
  return result.warnings;
}

function run(doc: unknown): ValidationResult {
  return validateSystemText(JSON.stringify(doc));
}

function nest(depth: number): SysNode {
  // builds a chain root -> n1 -> ... -> n<depth> without recursion
  let node: SysNode = { id: `n${depth}`, name: 'N', type: 'component' };
  for (let i = depth - 1; i >= 0; i--) {
    node = { id: `n${i}`, name: 'N', type: 'component', children: [node] };
  }
  return node;
}

describe('example system (SPEC §10)', () => {
  it('validates with no errors and no warnings', () => {
    const result = run(example);
    expect(result.ok).toBe(true);
    expect(warningsOf(result)).toEqual([]);
  });

  it('does not mutate the input', () => {
    const doc = exampleDoc();
    const before = JSON.stringify(doc);
    validateSystemDoc(doc);
    expect(JSON.stringify(doc)).toBe(before);
  });
});

describe('errors (SPEC §4.2)', () => {
  it('1. invalid JSON reports line and column', () => {
    const [issue] = errorsOf(validateSystemText('{\n  "id": "x",\n  oops\n}'));
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toMatch(/linha 3, coluna \d+/);
  });

  it('2. schema failure: missing field, wrong type, bad enum, schemaVersion', () => {
    const missing = minimalDoc() as Partial<SystemDoc>;
    delete missing.edges;
    const [missingIssue] = errorsOf(run(missing));
    expect(missingIssue?.path).toBe('edges');
    expect(missingIssue?.message).toContain('Campo obrigatório ausente.');

    const badEnum = minimalDoc();
    (badEnum.nodes[0] as { type: string }).type = 'mainframe';
    const [enumIssue] = errorsOf(run(badEnum));
    expect(enumIssue?.path).toBe('nodes[0].type');
    expect(enumIssue?.message).toContain('"a"');

    const wrongType = { ...minimalDoc(), name: 42 };
    expect(errorsOf(run(wrongType))[0]?.path).toBe('name');

    expect(errorsOf(run({ ...minimalDoc(), schemaVersion: 0 }))[0]?.path).toBe('schemaVersion');
  });

  it('2. schemaVersion newer than supported gives a clear message', () => {
    const [issue] = errorsOf(run({ ...minimalDoc(), schemaVersion: 3 }));
    expect(issue?.message).toContain('versão mais nova do sys-viz');
  });

  it('3. duplicate node id anywhere in the tree', () => {
    const doc = minimalDoc();
    doc.nodes[1] = {
      id: 'b',
      name: 'B',
      type: 'system',
      children: [{ id: 'a', name: 'A2', type: 'api' }],
    };
    expect(errorsOf(run(doc))).toContainEqual({
      severity: 'error',
      path: 'nodes[1].children[0].id',
      message: 'O id de nó "a" está duplicado.',
    });
  });

  it('4. duplicate edge id and duplicate flow id', () => {
    const doc = minimalDoc({
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e1', source: 'b', target: 'a' },
      ],
      flows: [
        { id: 'f', name: 'F', steps: [{ edgeId: 'e1' }] },
        { id: 'f', name: 'F2', steps: [{ edgeId: 'e1' }] },
      ],
    });
    const paths = errorsOf(run(doc)).map((i) => i.path);
    expect(paths).toContain('edges[1].id');
    expect(paths).toContain('flows[1].id');
  });

  it('5. edge pointing to a missing node names both ids', () => {
    const doc = exampleDoc();
    doc.edges[12] = { ...doc.edges[12]!, target: 'exchange-x' };
    expect(errorsOf(run(doc))).toContainEqual({
      severity: 'error',
      path: 'edges[12].target',
      message: 'A aresta "e13" aponta para o nó inexistente "exchange-x".',
    });
  });

  it('6. edge between a node and its ancestor/descendant, or itself', () => {
    const doc = exampleDoc();
    doc.edges.push({ id: 'e-up', source: 'fila-pedidos', target: 'sistema-pedidos' });
    doc.edges.push({ id: 'e-down', source: 'rabbitmq', target: 'fila-a' });
    doc.edges.push({ id: 'e-self', source: 'apigee', target: 'apigee' });
    const issues = errorsOf(run(doc));
    expect(issues.map((i) => i.path)).toEqual(['edges[21]', 'edges[22]', 'edges[23]']);
    expect(issues[0]?.message).toContain('"sistema-pedidos" ao seu descendente "fila-pedidos"');
  });

  it('7. flow step referencing a missing edge', () => {
    const doc = minimalDoc({ flows: [{ id: 'f', name: 'F', steps: [{ edgeId: 'nope' }] }] });
    expect(errorsOf(run(doc))[0]?.path).toBe('flows[0].steps[0].edgeId');
  });

  it('8. text larger than 5 MB is rejected before parsing', () => {
    const huge = 'x'.repeat(LIMITS.maxTextBytes + 1);
    const result = parseJsonText(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.message).toContain('5 MB');
  });

  it('8. children depth above 20 is rejected without stack overflow', () => {
    expect(run(minimalDoc({ nodes: [nest(LIMITS.maxDepth)], edges: [] })).ok).toBe(true);

    const tooDeep = errorsOf(run(minimalDoc({ nodes: [nest(LIMITS.maxDepth + 1)], edges: [] })));
    expect(tooDeep[0]?.message).toContain('20 níveis');

    // hostile nesting far beyond the limit must not blow the stack
    const hostile =
      '{"schemaVersion":1,"id":"x","name":"x","edges":[],"nodes":[' +
      '{"id":"n","name":"n","type":"api","children":['.repeat(5000) +
      ']}'.repeat(5000) +
      ']}';
    expect(errorsOf(validateSystemText(hostile))[0]?.message).toContain('20 níveis');
  });

  it('8. more than 2000 nodes is rejected', () => {
    const nodes: SysNode[] = Array.from({ length: LIMITS.maxNodes + 1 }, (_, i) => ({
      id: `n${i}`,
      name: 'N',
      type: 'api',
    }));
    expect(errorsOf(run(minimalDoc({ nodes, edges: [] })))[0]?.message).toContain('2000 nós');
  });

  it('9. forbidden metadata keys (__proto__, constructor, prototype)', () => {
    const text = JSON.stringify(minimalDoc()).replace(
      '"type":"api"',
      '"type":"api","metadata":{"__proto__":"x","constructor":"y"}',
    );
    const issues = errorsOf(validateSystemText(text));
    expect(issues.map((i) => i.path)).toEqual([
      'nodes[0].metadata.__proto__',
      'nodes[0].metadata.constructor',
    ]);

    const edgeText = JSON.stringify(minimalDoc()).replace(
      '"target":"b"',
      '"target":"b","metadata":{"prototype":"z"}',
    );
    expect(errorsOf(validateSystemText(edgeText))[0]?.path).toBe('edges[0].metadata.prototype');
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe('warnings (SPEC §4.2)', () => {
  it('1. step whose source was not reached by earlier steps (branch-aware)', () => {
    const doc = minimalDoc({
      nodes: [
        { id: 'a', name: 'A', type: 'api' },
        { id: 'b', name: 'B', type: 'database' },
        { id: 'c', name: 'C', type: 'queue' },
        { id: 'd', name: 'D', type: 'worker' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
        { id: 'e3', source: 'd', target: 'c' },
      ],
      flows: [
        { id: 'f', name: 'F', steps: [{ edgeId: 'e1' }, { edgeId: 'e2' }, { edgeId: 'e3' }] },
      ],
    });
    const warnings = warningsOf(run(doc));
    // e2 branches from "a" (reached by e1): fine; e3 starts at "d", never reached: warning
    expect(warnings).toEqual([
      expect.objectContaining({ severity: 'warning', path: 'flows[0].steps[2]' }),
    ]);
  });

  it('2. position for a missing node id is dropped', () => {
    const doc = minimalDoc({ layout: { positions: { a: { x: 1, y: 2 }, ghost: { x: 0, y: 0 } } } });
    const result = run(doc);
    expect(warningsOf(result)).toEqual([
      expect.objectContaining({ path: 'layout.positions.ghost' }),
    ]);
    if (result.ok) expect(result.value.layout?.positions).toEqual({ a: { x: 1, y: 2 } });
  });

  it('3. isolated root node warns; group whose edges link only its children does not', () => {
    const doc = minimalDoc({
      nodes: [
        { id: 'a', name: 'A', type: 'api' },
        { id: 'b', name: 'B', type: 'database' },
        { id: 'lonely', name: 'L', type: 'external' },
        {
          id: 'group',
          name: 'G',
          type: 'application',
          children: [
            { id: 'g1', name: 'G1', type: 'api' },
            { id: 'g2', name: 'G2', type: 'database' },
          ],
        },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'g1', target: 'g2' },
      ],
    });
    expect(warningsOf(run(doc))).toEqual([
      {
        severity: 'warning',
        path: 'nodes[2]',
        message: 'O nó raiz "lonely" não participa de nenhuma aresta (nem seus descendentes).',
      },
    ]);
  });

  it('4. unknown fields are dropped and reported with their path', () => {
    const doc = { ...minimalDoc(), extra: 1 } as SystemDoc & { extra: number };
    (doc.nodes[1] as SysNode & { foo: string }).foo = 'bar';
    const result = run(doc);
    expect(warningsOf(result).map((w) => w.path)).toEqual(['extra', 'nodes[1].foo']);
    if (result.ok) {
      expect('extra' in result.value).toBe(false);
      expect('foo' in result.value.nodes[1]!).toBe(false);
    }
  });

  it('metadata keys are data, not unknown fields', () => {
    const doc = minimalDoc();
    doc.nodes[0]!.metadata = { anything: 'goes' };
    expect(warningsOf(run(doc))).toEqual([]);
  });
});
