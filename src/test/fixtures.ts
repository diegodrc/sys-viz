import example from '../examples/example-system.json';
import { SystemDocSchema, type SystemDoc } from '../schema/system';

/** A fresh, schema-parsed copy of the example system (SPEC §10). */
export function exampleDoc(): SystemDoc {
  return SystemDocSchema.parse(structuredClone(example));
}
