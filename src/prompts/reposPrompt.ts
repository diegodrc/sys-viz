import exampleJson from '../examples/example-system-v2.json?raw';
import { systemDocJsonSchemaText } from '../schema/jsonSchema';
import { fillTemplate } from './fill';
import template from './repos.txt?raw';

// "Mapear a partir de repositórios" prompt (SPEC §9.4). The template text is copied verbatim from
// the spec by scripts/extract-prompts.mjs and must not be edited by hand.

export const REPOS_PROMPT_TEMPLATE: string = template;

export function buildReposPrompt(): string {
  return fillTemplate(REPOS_PROMPT_TEMPLATE, {
    JSON_SCHEMA: systemDocJsonSchemaText(),
    EXAMPLE_JSON: exampleJson.trim(),
  });
}
