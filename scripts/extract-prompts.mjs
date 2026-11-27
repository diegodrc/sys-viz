// Copies the literal AI prompts from SPEC.md §9.2, §9.3, §9.4 and §18.12 into src/prompts/*.txt.
// The text must not be edited by hand (SPEC §17); re-run this script if the spec changes.
import { readFileSync, writeFileSync } from 'node:fs';

export function extractPrompt(spec, heading) {
  const start = spec.indexOf(heading);
  if (start === -1) throw new Error(`heading not found: ${heading}`);
  const open = spec.indexOf('````text\n', start);
  const close = spec.indexOf('\n````', open + 1);
  if (open === -1 || close === -1) throw new Error(`prompt block not found after ${heading}`);
  return spec.slice(open + '````text\n'.length, close);
}

const spec = readFileSync(new URL('../SPEC.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
writeFileSync(
  new URL('../src/prompts/create.txt', import.meta.url),
  extractPrompt(spec, '### 9.2 Prompt de criação'),
);
writeFileSync(
  new URL('../src/prompts/evolve.txt', import.meta.url),
  extractPrompt(spec, '### 9.3 Prompt de evolução'),
);
writeFileSync(
  new URL('../src/prompts/repos.txt', import.meta.url),
  extractPrompt(spec, '### 9.4 Prompt de mapeamento a partir de repositórios'),
);
writeFileSync(
  new URL('../src/prompts/logic.txt', import.meta.url),
  extractPrompt(spec, '### 18.12 Prompt "Mapear lógica"'),
);
console.log('prompts extracted');
