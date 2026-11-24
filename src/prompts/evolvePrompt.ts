import type { SystemDoc } from '../schema/system';
import { systemDocJsonSchemaText } from '../schema/jsonSchema';
import template from './evolve.txt?raw';
import { fillTemplate } from './fill';

// "Evoluir sistema atual" prompt (SPEC §9.3). The template text is copied verbatim from the spec
// by scripts/extract-prompts.mjs and must not be edited by hand.

export const EVOLVE_PROMPT_TEMPLATE: string = template;

/** The current document without `layout` (positions are preserved on import by id). */
export function docWithoutLayout(doc: SystemDoc): Omit<SystemDoc, 'layout'> {
  const copy: SystemDoc = { ...doc };
  delete copy.layout;
  return copy;
}

export function buildEvolvePrompt(doc: SystemDoc): string {
  return fillTemplate(EVOLVE_PROMPT_TEMPLATE, {
    JSON_SCHEMA: systemDocJsonSchemaText(),
    CURRENT_JSON: JSON.stringify(docWithoutLayout(doc), null, 2),
  });
}
