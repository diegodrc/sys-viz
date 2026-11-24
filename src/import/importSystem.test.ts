import { describe, expect, it } from 'vitest';
import example from '../examples/example-system.json';
import type { SystemDoc } from '../schema/system';
import { buildBackup } from '../storage/backup';
import { exampleDoc } from '../test/fixtures';
import {
  asCopy,
  asReplacement,
  copyName,
  errorsForAi,
  nextCopyId,
  parseImport,
  planBackupImport,
} from './importSystem';

describe('parseImport', () => {
  it('A14: fenced example parses as a system with no warnings', () => {
    const result = parseImport('```json\n' + JSON.stringify(example) + '\n```');
    expect(result.kind).toBe('system');
    if (result.kind === 'system') expect(result.warnings).toEqual([]);
  });

  it('A12: edge to a missing node -> errors with path and id', () => {
    const doc = exampleDoc();
    doc.edges[0] = { ...doc.edges[0]!, target: 'nao-existe' };
    const result = parseImport(JSON.stringify(doc));
    expect(result).toEqual({
      kind: 'errors',
      errors: [
        {
          severity: 'error',
          path: 'edges[0].target',
          message: 'A aresta "e01" aponta para o nó inexistente "nao-existe".',
        },
      ],
    });
  });

  it('detects backups and validates each system', () => {
    const broken = {
      ...exampleDoc(),
      id: 'quebrado',
      edges: [{ id: 'x', source: 'a', target: 'b' }],
    };
    const backup = buildBackup([exampleDoc(), broken], new Date(0));
    const result = parseImport(JSON.stringify(backup));
    expect(result.kind).toBe('backup');
    if (result.kind === 'backup') {
      expect(result.backup.valid.map((v) => v.doc.id)).toEqual(['exemplo-pedidos']);
      expect(result.backup.invalid.map((v) => [v.index, v.id])).toEqual([[1, 'quebrado']]);
    }
  });

  it('rejects a backup from a newer version and a malformed backup', () => {
    expect(parseImport('{"sysvizBackup":2,"systems":[]}').kind).toBe('errors');
    expect(parseImport('{"sysvizBackup":1}').kind).toBe('errors');
  });

  it('reports an id duplicated inside the same backup', () => {
    const backup = buildBackup([exampleDoc(), exampleDoc()], new Date(0));
    const result = parseImport(JSON.stringify(backup));
    expect(result.kind === 'backup' && result.backup.invalid[0]?.index).toBe(1);
  });
});

describe('errorsForAi (SPEC §6.2)', () => {
  it('formats the header and one line per error', () => {
    expect(
      errorsForAi([
        { severity: 'error', path: 'edges[0].target', message: 'msg A' },
        { severity: 'error', path: '', message: 'msg B' },
      ]),
    ).toBe(
      'O JSON que você gerou para o sys-viz tem os erros abaixo. Corrija-os e devolva o JSON COMPLETO, mantendo todos os ids existentes.\n' +
        '- edges[0].target: msg A\n' +
        '- (documento): msg B',
    );
  });
});

describe('copies (SPEC §6.1 duplicar)', () => {
  it('generates -copia, -copia-2, -copia-3', () => {
    expect(nextCopyId('exemplo-pedidos', new Set(['exemplo-pedidos']))).toBe(
      'exemplo-pedidos-copia',
    );
    expect(nextCopyId('x', new Set(['x', 'x-copia']))).toBe('x-copia-2');
    expect(nextCopyId('x', new Set(['x', 'x-copia', 'x-copia-2']))).toBe('x-copia-3');
  });

  it('appends " (cópia)" truncating the original name to 80 characters total', () => {
    expect(copyName('Pedidos')).toBe('Pedidos (cópia)');
    const long = 'a'.repeat(80);
    const copy = copyName(long);
    expect(copy).toHaveLength(80);
    expect(copy.endsWith(' (cópia)')).toBe(true);
  });

  it('A13: import as copy creates exemplo-pedidos-copia', () => {
    const copy = asCopy(exampleDoc(), new Set(['exemplo-pedidos']));
    expect(copy.id).toBe('exemplo-pedidos-copia');
    expect(copy.name).toBe('Sistema de exemplo — Pedidos (cópia)');
  });
});

describe('replace (SPEC §6.2)', () => {
  it('A13: replace keeps saved positions for existing ids', () => {
    const previous = { ...exampleDoc(), layout: { positions: { apigee: { x: 5, y: 6 } } } };
    const replaced = asReplacement(previous, exampleDoc());
    expect(replaced.layout?.positions).toEqual({ apigee: { x: 5, y: 6 } });
    expect(asReplacement(undefined, exampleDoc()).layout).toBeUndefined();
  });
});

describe('planBackupImport (SPEC §6.2 step 6)', () => {
  const a = { ...exampleDoc(), id: 'a' };
  const b = { ...exampleDoc(), id: 'b' };
  const existingA = { ...a, name: 'Antigo', layout: { positions: { apigee: { x: 1, y: 1 } } } };
  const existing = new Map<string, SystemDoc | undefined>([['a', existingA]]);

  it('replace all: overwrites with merged positions', () => {
    const plan = planBackupImport([a, b], existing, 'replace');
    expect(plan.map((p) => [p.doc.id, p.replaces])).toEqual([
      ['a', true],
      ['b', false],
    ]);
    expect(plan[0]?.doc.layout?.positions).toEqual({ apigee: { x: 1, y: 1 } });
  });

  it('skip existing: only new ids', () => {
    expect(planBackupImport([a, b], existing, 'skip').map((p) => p.doc.id)).toEqual(['b']);
  });

  it('import as copies: unique copy ids', () => {
    const plan = planBackupImport(
      [a, b],
      new Map([
        ['a', a],
        ['a-copia', a],
      ]),
      'copy',
    );
    expect(plan.map((p) => p.doc.id)).toEqual(['a-copia-2', 'b']);
  });
});
