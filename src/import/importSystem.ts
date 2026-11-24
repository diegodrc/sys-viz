import { mergePositionsOnReplace } from '../graph/positions';
import { t } from '../i18n/pt-BR';
import type { Issue } from '../schema/result';
import { NAME_MAX, type SystemDoc } from '../schema/system';
import { parseJsonText, validateSystemDoc } from '../schema/validate';
import { detectImportKind, validateBackup, type BackupValidation } from '../storage/backup';
import { extractJsonText } from './preprocess';

// Import pipeline and id-conflict rules (SPEC §6.1 "duplicar", §6.2). Pure.

export type ParsedImport =
  | { kind: 'system'; doc: SystemDoc; warnings: Issue[] }
  | { kind: 'backup'; backup: Extract<BackupValidation, { ok: true }> }
  | { kind: 'errors'; errors: Issue[] };

/** Pre-process -> parse -> detect system/backup -> migrate + validate (SPEC §6.2 step 2). */
export function parseImport(text: string): ParsedImport {
  const parsed = parseJsonText(extractJsonText(text));
  if (!parsed.ok) return { kind: 'errors', errors: parsed.errors };
  if (detectImportKind(parsed.value) === 'backup') {
    const backup = validateBackup(parsed.value);
    return backup.ok ? { kind: 'backup', backup } : { kind: 'errors', errors: backup.errors };
  }
  const result = validateSystemDoc(parsed.value);
  return result.ok
    ? { kind: 'system', doc: result.value, warnings: result.warnings }
    : { kind: 'errors', errors: result.errors };
}

/** Text copied by "Copiar erros para a IA" (SPEC §6.2 step 3). */
export function errorsForAi(errors: readonly Issue[]): string {
  const lines = errors.map((issue) => `- ${issue.path || t.importer.rootPath}: ${issue.message}`);
  return [t.importer.aiErrorsHeader, ...lines].join('\n');
}

/** `<id>-copia`, then `<id>-copia-2`, `<id>-copia-3`... skipping ids already taken. */
export function nextCopyId(id: string, taken: ReadonlySet<string>): string {
  const base = `${id}-copia`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Name + " (cópia)", truncating the original so the result fits in NAME_MAX characters. */
export function copyName(name: string): string {
  const suffix = t.systems.copySuffix;
  const room = Math.max(0, NAME_MAX - suffix.length);
  const chars = Array.from(name);
  const base = chars.length > room ? chars.slice(0, room).join('').trimEnd() : name;
  return `${base}${suffix}`;
}

export function asCopy(doc: SystemDoc, taken: ReadonlySet<string>): SystemDoc {
  return { ...doc, id: nextCopyId(doc.id, taken), name: copyName(doc.name) };
}

/** "Substituir": incoming document with previous positions preserved (SPEC §6.2 step 5). */
export function asReplacement(previous: SystemDoc | undefined, incoming: SystemDoc): SystemDoc {
  return previous ? mergePositionsOnReplace(previous, incoming) : incoming;
}

export type BackupConflictStrategy = 'replace' | 'skip' | 'copy';

export interface BackupPlanItem {
  doc: SystemDoc;
  /** True when it overwrites an existing system (positions merged). */
  replaces: boolean;
}

/**
 * Resolves id conflicts of a backup with one strategy for all (SPEC §6.2 step 6).
 * `existing` maps ids already stored to their current document (undefined if unreadable).
 */
export function planBackupImport(
  docs: readonly SystemDoc[],
  existing: ReadonlyMap<string, SystemDoc | undefined>,
  strategy: BackupConflictStrategy,
): BackupPlanItem[] {
  const taken = new Set([...existing.keys(), ...docs.map((d) => d.id)]);
  const plan: BackupPlanItem[] = [];
  for (const doc of docs) {
    if (!existing.has(doc.id)) {
      plan.push({ doc, replaces: false });
    } else if (strategy === 'replace') {
      plan.push({ doc: asReplacement(existing.get(doc.id), doc), replaces: true });
    } else if (strategy === 'copy') {
      const copy = asCopy(doc, taken);
      taken.add(copy.id);
      plan.push({ doc: copy, replaces: false });
    }
  }
  return plan;
}
