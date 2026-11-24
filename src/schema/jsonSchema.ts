import { z } from 'zod';
import { SystemDocSchema } from './system';

// JSON Schema embedded in the AI prompts (SPEC §9.1, {{JSON_SCHEMA}}).
export function systemDocJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(SystemDocSchema);
}

export function systemDocJsonSchemaText(): string {
  return JSON.stringify(systemDocJsonSchema(), null, 2);
}
