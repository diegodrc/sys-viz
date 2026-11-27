import example from '../examples/example-system-v2.json';
import exampleV1 from '../examples/example-system.json';
import { migrate } from '../schema/migrations';
import { SystemDocSchema, type SystemDoc } from '../schema/system';

/** A fresh, schema-parsed copy of the example the app loads (SPEC §10 + §18.13 logic). */
export function exampleDoc(): SystemDoc {
  return SystemDocSchema.parse(structuredClone(example));
}

/** The SPEC §10 example (v1, no logic) migrated to the current schema version. */
export function exampleDocV1(): SystemDoc {
  const migrated = migrate(structuredClone(exampleV1));
  if (!migrated.ok) throw new Error('the v1 example must migrate');
  return SystemDocSchema.parse(migrated.value);
}
