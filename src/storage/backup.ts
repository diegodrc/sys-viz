import { t } from '../i18n/pt-BR';
import { error, type Issue } from '../schema/result';
import type { SystemDoc } from '../schema/system';
import { validateSystemDoc } from '../schema/validate';

// Backup format (SPEC §4.4) and export file naming (SPEC §6.3). Pure.

export const BACKUP_VERSION = 1;

export interface Backup {
  sysvizBackup: typeof BACKUP_VERSION;
  exportedAt: string;
  systems: SystemDoc[];
}

export function buildBackup(systems: readonly SystemDoc[], exportedAt: Date): Backup {
  return {
    sysvizBackup: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    systems: [...systems],
  };
}

/** JSON as written to exported files: 2-space indentation (SPEC §6.3). */
export function toExportJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function systemFileName(id: string): string {
  return `${id}.json`;
}

/** `sysviz-backup-AAAA-MM-DD.json`, using the user's local date. */
export function backupFileName(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `sysviz-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

export type ImportKind = 'backup' | 'system';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** SPEC §4.4: a backup has `sysvizBackup`; anything else is treated as a SystemDoc. */
export function detectImportKind(data: unknown): ImportKind {
  return isRecord(data) && 'sysvizBackup' in data ? 'backup' : 'system';
}

export interface ValidBackupEntry {
  doc: SystemDoc;
  warnings: Issue[];
}

export interface InvalidBackupEntry {
  /** Position in `systems` (0-based). */
  index: number;
  id: string | undefined;
  errors: Issue[];
}

export type BackupValidation =
  | { ok: true; valid: ValidBackupEntry[]; invalid: InvalidBackupEntry[] }
  | { ok: false; errors: Issue[] };

/** Validates every system of a backup independently (SPEC §6.2 item 6). */
export function validateBackup(data: unknown): BackupValidation {
  if (!isRecord(data)) return { ok: false, errors: [error('', t.validation.notAnObject)] };
  const version = data.sysvizBackup;
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    return { ok: false, errors: [error('sysvizBackup', t.backup.newerVersion(version))] };
  }
  if (version !== BACKUP_VERSION) {
    return { ok: false, errors: [error('sysvizBackup', t.backup.invalidVersion)] };
  }
  if (!Array.isArray(data.systems)) {
    return { ok: false, errors: [error('systems', t.backup.missingSystems)] };
  }

  const valid: ValidBackupEntry[] = [];
  const invalid: InvalidBackupEntry[] = [];
  const seen = new Set<string>();
  data.systems.forEach((raw: unknown, index) => {
    const rawId = isRecord(raw) && typeof raw.id === 'string' ? raw.id : undefined;
    const result = validateSystemDoc(raw);
    if (!result.ok) {
      invalid.push({ index, id: rawId, errors: result.errors });
    } else if (seen.has(result.value.id)) {
      invalid.push({
        index,
        id: result.value.id,
        errors: [error(`systems[${index}].id`, t.backup.duplicateSystemId(result.value.id))],
      });
    } else {
      seen.add(result.value.id);
      valid.push({ doc: result.value, warnings: result.warnings });
    }
  });
  return { ok: true, valid, invalid };
}
