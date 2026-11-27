import { describe, expect, it } from 'vitest';
import example from '../examples/example-system-v2.json';
import { systemDocJsonSchema, systemDocJsonSchemaText } from './jsonSchema';
import { SystemDocSchema } from './system';

describe('systemDocJsonSchema', () => {
  it('generates a JSON Schema from the Zod schema', () => {
    const schema = systemDocJsonSchema();
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(
      expect.arrayContaining(['schemaVersion', 'id', 'name', 'nodes', 'edges']) as unknown,
    );
    expect(JSON.parse(systemDocJsonSchemaText())).toEqual(schema);
  });

  it('describes the recursive children and the node type enum', () => {
    const text = systemDocJsonSchemaText();
    expect(text).toContain('"children"');
    expect(text).toContain('"gateway"');
    expect(text).toContain('^[a-z0-9][a-z0-9-]*$');
  });

  it('the example validates against the Zod schema', () => {
    expect(SystemDocSchema.safeParse(example).success).toBe(true);
  });
});
