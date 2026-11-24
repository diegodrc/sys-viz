import { describe, expect, it } from 'vitest';
import specRaw from '../../SPEC.md?raw';
import exampleRaw from '../examples/example-system.json?raw';
import { systemDocJsonSchemaText } from '../schema/jsonSchema';
import { exampleDoc } from '../test/fixtures';
import { buildCreatePrompt, CREATE_PROMPT_TEMPLATE } from './createPrompt';
import { buildEvolvePrompt, EVOLVE_PROMPT_TEMPLATE } from './evolvePrompt';
import { fillTemplate } from './fill';

const spec = specRaw.replace(/\r\n/g, '\n');
const FENCE = '````text\n';

/** Independent re-implementation of the extraction: the text inside the ````text fence. */
function extractPrompt(source: string, heading: string): string {
  const start = source.indexOf(heading);
  const open = source.indexOf(FENCE, start);
  const close = source.indexOf('\n````', open + 1);
  if (start === -1 || open === -1 || close === -1) throw new Error(`prompt not found: ${heading}`);
  return source.slice(open + FENCE.length, close);
}

describe('prompt templates are the literal SPEC §9 text', () => {
  it('create prompt (§9.2) is byte-equal to the spec', () => {
    expect(CREATE_PROMPT_TEMPLATE).toBe(extractPrompt(spec, '### 9.2 Prompt de criação'));
    expect(CREATE_PROMPT_TEMPLATE.startsWith('Você é um arquiteto de software')).toBe(true);
  });

  it('evolve prompt (§9.3) is byte-equal to the spec', () => {
    expect(EVOLVE_PROMPT_TEMPLATE).toBe(extractPrompt(spec, '### 9.3 Prompt de evolução'));
    expect(
      EVOLVE_PROMPT_TEMPLATE.endsWith(
        'Comece com o resumo do documento atual e a primeira pergunta.',
      ),
    ).toBe(true);
  });
});

describe('placeholders (SPEC §9.1)', () => {
  it('create prompt embeds the JSON Schema and the example file', () => {
    const prompt = buildCreatePrompt();
    expect(prompt).not.toContain('{{');
    expect(prompt).toContain(systemDocJsonSchemaText());
    expect(prompt).toContain(exampleRaw.trim());
    expect(prompt).toContain('```json\n{\n  "schemaVersion": 1,');
  });

  it('A17: evolve prompt embeds the current document without layout', () => {
    const doc = { ...exampleDoc(), layout: { positions: { apigee: { x: 1, y: 2 } } } };
    const prompt = buildEvolvePrompt(doc);
    expect(prompt).not.toContain('{{');
    expect(prompt).toContain(systemDocJsonSchemaText());
    // the embedded document (after "## Documento atual") has no layout/positions
    const current = prompt.slice(prompt.indexOf('## Documento atual'));
    expect(current).not.toContain('"layout"');
    expect(current).not.toContain('"positions"');
    expect(current).toContain(JSON.stringify(exampleDoc(), null, 2));
  });

  it('values containing $ patterns are inserted literally', () => {
    expect(fillTemplate('a {{X}} b {{X}}', { X: "$& $1 $'" })).toBe("a $& $1 $' b $& $1 $'");
  });
});
