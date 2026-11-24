import { describe, expect, it } from 'vitest';
import { exampleDoc } from '../test/fixtures';
import {
  draftToEdge,
  draftToFlow,
  draftToNode,
  draftToSystemInfo,
  edgeToDraft,
  flowToDraft,
  nodeToDraft,
  replaceEdge,
  replaceNode,
  replaceSystemInfo,
} from './edit';
import type { SysNode } from './system';

const doc = exampleDoc();

function node(id: string): SysNode {
  const stack = [...doc.nodes];
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) break;
    if (n.id === id) return n;
    stack.push(...(n.children ?? []));
  }
  throw new Error(`node ${id} not found`);
}

describe('node drafts (SPEC §6.6)', () => {
  it('an untouched draft round-trips to an identical node', () => {
    for (const id of ['akamai', 'worker-pedidos', 'sistema-pedidos', 'exchange-a', 'usuario']) {
      const original = node(id);
      const result = draftToNode(original, nodeToDraft(original));
      expect(result).toEqual({ ok: true, value: original });
    }
  });

  it('A11: renaming keeps the id and children', () => {
    const original = node('api-pedidos');
    const result = draftToNode(original, { ...nodeToDraft(original), name: 'API Orders' });
    expect(result.ok && result.value).toMatchObject({ id: 'api-pedidos', name: 'API Orders' });
  });

  it('empty name and names over 80 chars are field errors', () => {
    const original = node('api-pedidos');
    expect(draftToNode(original, { ...nodeToDraft(original), name: '  ' })).toEqual({
      ok: false,
      errors: { name: 'O texto não pode ser vazio.' },
    });
    const long = draftToNode(original, { ...nodeToDraft(original), name: 'x'.repeat(81) });
    expect(!long.ok && long.errors.name).toContain('80');
  });

  it('metadata keys must be unique, non-empty and not reserved', () => {
    const original = node('api-pedidos');
    const result = draftToNode(original, {
      ...nodeToDraft(original),
      metadata: [
        { key: 'a', value: '1' },
        { key: 'a', value: '2' },
        { key: '', value: '3' },
        { key: '__proto__', value: '4' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        'metadata.1.key',
        'metadata.2.key',
        'metadata.3.key',
      ]);
    }
  });

  it('a link needs a url; empty optional inputs become absent fields', () => {
    const original = node('akamai');
    const draft = {
      ...nodeToDraft(original),
      description: '',
      technology: '   ',
      platform: '' as const,
      links: [{ key: 'Docs', value: '' }],
    };
    const result = draftToNode(original, draft);
    expect(!result.ok && result.errors['links.0.url']).toBe('O texto não pode ser vazio.');

    const fixed = draftToNode(original, { ...draft, links: [] });
    expect(fixed.ok && fixed.value).toEqual({ id: 'akamai', name: 'Akamai', type: 'cdn' });
  });

  it('confidence: toggling keeps an explicit "confirmed" but does not invent one', () => {
    const assumed = node('worker-pedidos');
    const confirmed = draftToNode(assumed, { ...nodeToDraft(assumed), assumed: false });
    expect(confirmed.ok && 'confidence' in confirmed.value).toBe(false);

    const explicit = { ...node('apigee'), confidence: 'confirmed' as const };
    const kept = draftToNode(explicit, nodeToDraft(explicit));
    expect(kept.ok && kept.value.confidence).toBe('confirmed');
  });

  it('replaceNode updates a nested node without mutating the document', () => {
    const before = JSON.stringify(doc);
    const updated = replaceNode(doc, { ...node('fila-pedidos'), name: 'Fila' });
    expect(JSON.stringify(doc)).toBe(before);
    const db = updated.nodes
      .find((n) => n.id === 'sistema-pedidos')
      ?.children?.find((c) => c.id === 'db-pedidos');
    expect(db?.children?.[0]?.name).toBe('Fila');
  });
});

describe('edge, flow and system drafts', () => {
  it('edges round-trip; label over 40 chars is an error', () => {
    for (const edge of doc.edges) {
      expect(draftToEdge(edge, edgeToDraft(edge))).toEqual({ ok: true, value: edge });
    }
    const e13 = doc.edges[12]!;
    const result = draftToEdge(e13, { ...edgeToDraft(e13), label: 'x'.repeat(41) });
    expect(!result.ok && result.errors.label).toContain('40');
  });

  it('edge mode can be unset and confidence toggled', () => {
    const e01 = doc.edges[0]!;
    const result = draftToEdge(e01, { ...edgeToDraft(e01), mode: '', assumed: true });
    expect(result.ok && result.value).toMatchObject({ id: 'e01', confidence: 'assumed' });
    expect(result.ok && 'mode' in result.value).toBe(false);
    expect(replaceEdge(doc, { ...e01, label: 'x' }).edges[0]?.label).toBe('x');
  });

  it('flows: name and description only, steps untouched', () => {
    const flow = doc.flows![0]!;
    const result = draftToFlow(flow, { ...flowToDraft(flow), name: 'Novo', description: '' });
    expect(result.ok && result.value).toEqual({ id: flow.id, name: 'Novo', steps: flow.steps });
  });

  it('system info: name required, empty description removed', () => {
    expect(draftToSystemInfo({ name: ' ', description: '' }).ok).toBe(false);
    const info = draftToSystemInfo({ name: 'Outro', description: '' });
    expect(info.ok && replaceSystemInfo(doc, info.value)).toMatchObject({ name: 'Outro' });
    expect(info.ok && 'description' in replaceSystemInfo(doc, info.value)).toBe(false);
  });
});
