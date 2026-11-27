// Builds src/examples/example-system-v2.json = SPEC §10 example + schemaVersion 2 + the `logic`
// of SPEC §18.13 (SPEC §18.10). Re-run if either part of the spec changes; a test checks it.
import { readFileSync, writeFileSync } from 'node:fs';

export function jsonBlockAfter(spec, heading) {
  const start = spec.indexOf(heading);
  if (start === -1) throw new Error(`heading not found: ${heading}`);
  const open = spec.indexOf('```json\n{', start);
  const close = spec.indexOf('\n```', open + 8);
  return JSON.parse(spec.slice(open + '```json\n'.length, close));
}

const spec = readFileSync(new URL('../SPEC.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const v1 = JSON.parse(
  readFileSync(new URL('../src/examples/example-system.json', import.meta.url), 'utf8'),
);
const logic = jsonBlockAfter(spec, '### 18.13 Exemplo de lógica');
const v2 = { ...v1, schemaVersion: 2, logic };
writeFileSync(
  new URL('../src/examples/example-system-v2.json', import.meta.url),
  `${JSON.stringify(v2, null, 2)}\n`,
);
console.log('example-system-v2.json written');
