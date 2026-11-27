import { describe, expect, it } from 'vitest';
import { migrate } from './migrations';

describe('migrate', () => {
  it('passes the current version through unchanged', () => {
    const doc = { schemaVersion: 2, id: 'x' };
    expect(migrate(doc)).toEqual({ ok: true, value: doc });
  });

  it('L1: upgrades v1 documents to v2 without adding logic (SPEC §18.10)', () => {
    const doc = { schemaVersion: 1, id: 'x', nodes: [] };
    expect(migrate(doc)).toEqual({ ok: true, value: { schemaVersion: 2, id: 'x', nodes: [] } });
    expect(doc.schemaVersion).toBe(1); // input not mutated
  });

  it('rejects documents from a newer version', () => {
    const result = migrate({ schemaVersion: 3 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.path).toBe('schemaVersion');
      expect(result.errors[0]?.message).toContain('versão mais nova do sys-viz');
    }
  });

  it('leaves non-objects and missing versions for the schema to report', () => {
    expect(migrate('text')).toEqual({ ok: true, value: 'text' });
    expect(migrate({ id: 'x' })).toEqual({ ok: true, value: { id: 'x' } });
  });
});
