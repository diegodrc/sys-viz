import { describe, expect, it } from 'vitest';
import example from '../examples/example-system-v2.json';
import { SystemDocSchema, type SysNode } from './system';

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('SystemDocSchema', () => {
  it('accepts the example system (SPEC §10 + §18.13)', () => {
    const result = SystemDocSchema.safeParse(example);
    expect(result.success).toBe(true);
  });

  it('infers a recursive node type', () => {
    const parsed = SystemDocSchema.parse(example);
    const pedidos = parsed.nodes.find((n) => n.id === 'sistema-pedidos');
    const db: SysNode | undefined = pedidos?.children?.find((c) => c.id === 'db-pedidos');
    expect(db?.children?.[0]?.id).toBe('fila-pedidos');
  });

  it('rejects a missing required field', () => {
    const doc = clone(example) as Record<string, unknown>;
    delete doc.nodes;
    expect(SystemDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an invalid enum value', () => {
    const doc = clone(example);
    (doc.nodes[0] as { type: string }).type = 'mainframe';
    expect(SystemDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects schemaVersion other than 2 (older versions are migrated before parsing)', () => {
    expect(SystemDocSchema.safeParse({ ...example, schemaVersion: 1 }).success).toBe(false);
  });

  it('rejects ids outside the kebab-case pattern', () => {
    const doc = clone(example);
    doc.nodes[0]!.id = 'Usuario';
    expect(SystemDocSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects edge labels longer than 40 chars', () => {
    const doc = clone(example);
    doc.edges[0]!.label = 'x'.repeat(41);
    expect(SystemDocSchema.safeParse(doc).success).toBe(false);
  });

  it('does not add defaults for absent optional fields', () => {
    const parsed = SystemDocSchema.parse(example);
    expect('confidence' in parsed.nodes[0]!).toBe(false);
  });

  it('strips unknown keys', () => {
    const doc = { ...clone(example), extra: true };
    const parsed = SystemDocSchema.parse(doc);
    expect('extra' in parsed).toBe(false);
  });
});
