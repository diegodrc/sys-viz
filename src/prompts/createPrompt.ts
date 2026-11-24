import exampleJson from '../examples/example-system.json?raw';
import { systemDocJsonSchemaText } from '../schema/jsonSchema';
import template from './create.txt?raw';
import { fillTemplate } from './fill';

// "Criar novo sistema" prompt (SPEC §9.2). The template text is copied verbatim from the spec by
// scripts/extract-prompts.mjs and must not be edited by hand.

export const CREATE_PROMPT_TEMPLATE: string = template;

export function buildCreatePrompt(): string {
  return fillTemplate(CREATE_PROMPT_TEMPLATE, {
    JSON_SCHEMA: systemDocJsonSchemaText(),
    EXAMPLE_JSON: exampleJson.trim(),
  });
}
