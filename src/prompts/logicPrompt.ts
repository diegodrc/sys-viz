import { systemDocJsonSchemaText } from '../schema/jsonSchema';
import type { SystemDoc } from '../schema/system';
import { docWithoutLayout } from './evolvePrompt';
import { fillTemplate } from './fill';
import template from './logic.txt?raw';

// "Mapear lógica" prompt (SPEC §18.12). The template text is copied verbatim from the spec by
// scripts/extract-prompts.mjs and must not be edited by hand.

export const LOGIC_PROMPT_TEMPLATE: string = template;

export function buildLogicPrompt(doc: SystemDoc): string {
  return fillTemplate(LOGIC_PROMPT_TEMPLATE, {
    JSON_SCHEMA: systemDocJsonSchemaText(),
    CURRENT_JSON: JSON.stringify(docWithoutLayout(doc), null, 2),
  });
}
