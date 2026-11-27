import { t } from '../i18n/pt-BR';
import { error, type Result } from './result';
import { SCHEMA_VERSION } from './system';

// SPEC §4.5: schemaVersion -> function that upgrades a document from that version to the next.
type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
export const migrations: Readonly<Record<number, Migration>> = {
  // SPEC §18.10: v2 only adds the optional `logic` section, so v1 documents just change version
  1: (doc) => ({ ...doc, schemaVersion: 2 }),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Upgrades a raw (unvalidated) document to the current schema version. Anything that is not a
 * recognizable older version is passed through unchanged so that the schema reports it.
 */
export function migrate(data: unknown): Result<unknown> {
  if (!isRecord(data)) return { ok: true, value: data };
  const version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) return { ok: true, value: data };
  if (version > SCHEMA_VERSION) {
    return { ok: false, errors: [error('schemaVersion', t.validation.newerVersion(version))] };
  }
  let current = data;
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const step = migrations[v];
    if (!step) return { ok: true, value: current };
    current = step(current);
  }
  return { ok: true, value: current };
}
