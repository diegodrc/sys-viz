import { describe, expect, it } from 'vitest';
import { extractJsonText } from './preprocess';

const DOC = '{\n  "a": 1\n}';

describe('extractJsonText (SPEC §4.3)', () => {
  it('keeps plain JSON intact (only trims surrounding whitespace)', () => {
    expect(extractJsonText(DOC)).toBe(DOC);
    expect(extractJsonText(`\n\n  ${DOC}  \n`)).toBe(DOC);
  });

  it('removes ```json fences', () => {
    expect(extractJsonText('```json\n' + DOC + '\n```')).toBe(DOC);
  });

  it('removes bare ``` fences and handles CRLF', () => {
    expect(extractJsonText('```\r\n{"a":1}\r\n```')).toBe('{"a":1}');
  });

  it('uses the first fenced block that is valid JSON', () => {
    const text = [
      'Aqui está o resumo:',
      '```text\nnão é json\n```',
      'E o documento:',
      '```json\n{"first":true}\n```',
      '```json\n{"second":true}\n```',
    ].join('\n');
    expect(extractJsonText(text)).toBe('{"first":true}');
  });

  it('returns the first block when no fenced block is valid JSON', () => {
    expect(extractJsonText('```json\n{broken\n```\n```json\n{also broken\n```')).toBe('{broken');
  });

  it('extracts from the first { to the last } when the AI added prose', () => {
    const text = 'Claro! Segue o JSON: {"a": {"b": 1}} Espero ter ajudado.';
    expect(extractJsonText(text)).toBe('{"a": {"b": 1}}');
  });

  it('returns the original text when nothing parses, so its error is reported', () => {
    const text = 'sem json aqui { nem } isto';
    expect(extractJsonText(text)).toBe(text);
  });
});

describe('preprocess + validate (A14)', () => {
  it('a ```json-wrapped example imports normally', async () => {
    const { default: example } = await import('../examples/example-system.json');
    const { validateSystemText } = await import('../schema/validate');
    const pasted = 'Segue o documento:\n```json\n' + JSON.stringify(example, null, 2) + '\n```\n';
    const result = validateSystemText(extractJsonText(pasted));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toEqual([]);
  });
});
