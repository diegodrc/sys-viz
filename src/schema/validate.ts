import type { z } from 'zod';
import { t } from '../i18n/pt-BR';
import { migrate } from './migrations';
import { error, formatPath, warning, type Issue, type PathSegment } from './result';
import { SystemDocSchema, type SysEdge, type SysNode, type SystemDoc } from './system';

// Import validation (SPEC §4.2). Pure: never mutates its input and never throws for bad data.

export const LIMITS = {
  maxTextBytes: 5 * 1024 * 1024,
  /** Maximum nesting of `children` below a root node (root = level 0). */
  maxDepth: 20,
  maxNodes: 2000,
} as const;

const FORBIDDEN_METADATA_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

export type ValidationResult =
  { ok: true; value: SystemDoc; warnings: Issue[] } | { ok: false; errors: Issue[] };

export type ParseResult = { ok: true; value: unknown } | { ok: false; errors: Issue[] };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function idOf(value: unknown): string | undefined {
  return isRecord(value) && typeof value.id === 'string' ? value.id : undefined;
}

// ---------------------------------------------------------------------------------------------
// Text -> JSON (rules 1 and 8: size is checked before parsing)

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function lineColumnAt(text: string, position: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < position && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: position - lineStart + 1 };
}

function describeParseError(text: string, cause: unknown): string {
  const detail = cause instanceof Error ? cause.message : String(cause);
  // Firefox: "... at line 3 column 5 of the JSON data"; V8 (newer): "... (line 3 column 5)"
  const lineCol = /line (\d+) column (\d+)/.exec(detail);
  if (lineCol?.[1] && lineCol[2]) {
    return t.validation.invalidJsonAt(Number(lineCol[1]), Number(lineCol[2]), detail);
  }
  // V8 (older): "... in JSON at position 42"
  const position = /position (\d+)/.exec(detail);
  if (position?.[1]) {
    const { line, column } = lineColumnAt(text, Number(position[1]));
    return t.validation.invalidJsonAt(line, column, detail);
  }
  return t.validation.invalidJson(detail);
}

export function parseJsonText(text: string): ParseResult {
  if (text.length > LIMITS.maxTextBytes || utf8Length(text) > LIMITS.maxTextBytes) {
    return {
      ok: false,
      errors: [error('', t.validation.tooLarge(LIMITS.maxTextBytes / (1024 * 1024)))],
    };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (cause) {
    return { ok: false, errors: [error('', describeParseError(text, cause))] };
  }
}

// ---------------------------------------------------------------------------------------------
// Pre-schema checks on raw data (rules 8 and 9). Iterative so hostile nesting cannot overflow
// the stack; must run before Zod, which recurses into `children`.

function checkMetadataKeys(owner: UnknownRecord, path: PathSegment[], issues: Issue[]): void {
  const metadata = owner.metadata;
  if (!isRecord(metadata)) return;
  for (const key of Object.keys(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key)) {
      issues.push(
        error(
          formatPath([...path, 'metadata', key]),
          t.validation.forbiddenMetadataKey(key, idOf(owner)),
        ),
      );
    }
  }
}

function precheck(data: UnknownRecord): Issue[] {
  const issues: Issue[] = [];
  const roots = data.nodes;
  if (Array.isArray(roots)) {
    const stack: { value: unknown; path: PathSegment[]; depth: number }[] = [];
    for (let i = roots.length - 1; i >= 0; i--) {
      stack.push({ value: roots[i], path: ['nodes', i], depth: 0 });
    }
    let count = 0;
    while (stack.length > 0) {
      const entry = stack.pop();
      if (!entry || !isRecord(entry.value)) continue;
      count++;
      if (count > LIMITS.maxNodes) {
        issues.push(error('nodes', t.validation.tooManyNodes(LIMITS.maxNodes)));
        break;
      }
      if (entry.depth > LIMITS.maxDepth) {
        issues.push(
          error(formatPath(entry.path), t.validation.tooDeep(LIMITS.maxDepth, idOf(entry.value))),
        );
        break;
      }
      checkMetadataKeys(entry.value, entry.path, issues);
      const children = entry.value.children;
      if (Array.isArray(children)) {
        for (let i = children.length - 1; i >= 0; i--) {
          stack.push({
            value: children[i],
            path: [...entry.path, 'children', i],
            depth: entry.depth + 1,
          });
        }
      }
    }
  }
  const edges = data.edges;
  if (Array.isArray(edges)) {
    edges.forEach((edge, i) => {
      if (isRecord(edge)) checkMetadataKeys(edge, ['edges', i], issues);
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------------------------
// Zod issues -> pt-BR issues (rule 2)

function nearestId(data: unknown, path: readonly PathSegment[]): string | undefined {
  let current: unknown = data;
  let found: string | undefined;
  for (const segment of path) {
    const id = idOf(current);
    if (id !== undefined) found = id;
    if (Array.isArray(current) && typeof segment === 'number') current = current[segment];
    else if (isRecord(current) && typeof segment === 'string') current = current[segment];
    else break;
  }
  return found;
}

function schemaMessage(issue: z.core.$ZodIssue): string {
  const m = t.validation.schema;
  switch (issue.code) {
    case 'invalid_type':
      return issue.input === undefined ? m.required : m.wrongType(issue.expected);
    case 'invalid_value':
      return m.invalidValue(issue.values.map((v) => JSON.stringify(v)).join(', '));
    case 'invalid_format':
      return issue.format === 'regex' ? m.invalidId : m.generic;
    case 'too_small':
      if (issue.origin === 'string') return m.tooShortString(Number(issue.minimum));
      if (issue.origin === 'array') return m.tooFewItems(Number(issue.minimum));
      return m.generic;
    case 'too_big':
      if (issue.origin === 'string') return m.tooLongString(Number(issue.maximum));
      if (issue.origin === 'array') return m.tooManyItems(Number(issue.maximum));
      return m.generic;
    default:
      return m.generic;
  }
}

function schemaIssues(data: unknown, issues: readonly z.core.$ZodIssue[]): Issue[] {
  return issues.map((issue) => {
    const path = issue.path.map((p): PathSegment => (typeof p === 'number' ? p : String(p)));
    const message = schemaMessage(issue);
    const id = nearestId(data, path);
    return error(formatPath(path), id ? t.validation.schema.withId(message, id) : message);
  });
}

// ---------------------------------------------------------------------------------------------
// Semantic checks on the parsed document (rules 3-7)

interface NodeEntry {
  node: SysNode;
  path: PathSegment[];
  parentId: string | undefined;
}

function walkNodes(doc: SystemDoc): NodeEntry[] {
  const out: NodeEntry[] = [];
  const stack: NodeEntry[] = [];
  for (let i = doc.nodes.length - 1; i >= 0; i--) {
    const node = doc.nodes[i];
    if (node) stack.push({ node, path: ['nodes', i], parentId: undefined });
  }
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) break;
    out.push(entry);
    const children = entry.node.children ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child) {
        stack.push({ node: child, path: [...entry.path, 'children', i], parentId: entry.node.id });
      }
    }
  }
  return out;
}

function isAncestor(
  ancestorId: string,
  nodeId: string,
  parentOf: ReadonlyMap<string, string | undefined>,
): boolean {
  let current = parentOf.get(nodeId);
  while (current !== undefined) {
    if (current === ancestorId) return true;
    current = parentOf.get(current);
  }
  return false;
}

function semanticErrors(doc: SystemDoc, entries: readonly NodeEntry[]): Issue[] {
  const v = t.validation;
  const issues: Issue[] = [];

  const parentOf = new Map<string, string | undefined>();
  for (const { node, path, parentId } of entries) {
    if (parentOf.has(node.id)) {
      issues.push(error(formatPath([...path, 'id']), v.duplicateNodeId(node.id)));
    } else {
      parentOf.set(node.id, parentId);
    }
  }

  const edgeIds = new Set<string>();
  doc.edges.forEach((edge, i) => {
    if (edgeIds.has(edge.id)) {
      issues.push(error(formatPath(['edges', i, 'id']), v.duplicateEdgeId(edge.id)));
    }
    edgeIds.add(edge.id);

    const sourceExists = parentOf.has(edge.source);
    const targetExists = parentOf.has(edge.target);
    if (!sourceExists) {
      issues.push(
        error(formatPath(['edges', i, 'source']), v.missingEdgeEnd(edge.id, edge.source)),
      );
    }
    if (!targetExists) {
      issues.push(
        error(formatPath(['edges', i, 'target']), v.missingEdgeEnd(edge.id, edge.target)),
      );
    }
    if (!sourceExists || !targetExists) return;
    if (edge.source === edge.target) {
      issues.push(error(formatPath(['edges', i]), v.selfEdge(edge.id, edge.source)));
    } else if (isAncestor(edge.source, edge.target, parentOf)) {
      issues.push(
        error(formatPath(['edges', i]), v.ancestorEdge(edge.id, edge.source, edge.target)),
      );
    } else if (isAncestor(edge.target, edge.source, parentOf)) {
      issues.push(
        error(formatPath(['edges', i]), v.ancestorEdge(edge.id, edge.target, edge.source)),
      );
    }
  });

  const flowIds = new Set<string>();
  (doc.flows ?? []).forEach((flow, i) => {
    if (flowIds.has(flow.id)) {
      issues.push(error(formatPath(['flows', i, 'id']), v.duplicateFlowId(flow.id)));
    }
    flowIds.add(flow.id);
    flow.steps.forEach((step, j) => {
      if (!edgeIds.has(step.edgeId)) {
        issues.push(
          error(
            formatPath(['flows', i, 'steps', j, 'edgeId']),
            v.missingFlowEdge(flow.id, j + 1, step.edgeId),
          ),
        );
      }
    });
  });

  return issues;
}

// ---------------------------------------------------------------------------------------------
// Warnings (rules 1-4)

function disconnectedStepWarnings(doc: SystemDoc): Issue[] {
  // Branch-aware (DECISIONS.md): a step is connected if its source was reached by any earlier
  // step, so "finish one branch, then start the next from an earlier node" does not warn.
  const edgesById = new Map<string, SysEdge>(doc.edges.map((e) => [e.id, e]));
  const issues: Issue[] = [];
  (doc.flows ?? []).forEach((flow, i) => {
    const reached = new Set<string>();
    flow.steps.forEach((step, j) => {
      const edge = edgesById.get(step.edgeId);
      if (!edge) return;
      if (j > 0 && !reached.has(edge.source)) {
        issues.push(
          warning(
            formatPath(['flows', i, 'steps', j]),
            t.validation.disconnectedStep(flow.id, j + 1, edge.id, edge.source),
          ),
        );
      }
      reached.add(edge.source);
      reached.add(edge.target);
    });
  });
  return issues;
}

function isolatedRootWarnings(doc: SystemDoc, entries: readonly NodeEntry[]): Issue[] {
  const connected = new Set<string>();
  for (const edge of doc.edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  // a root is connected if any node in its subtree is; entries carry the root index in path[1]
  const rootHasEdge = new Set<number>();
  for (const { node, path } of entries) {
    const rootIndex = path[1];
    if (typeof rootIndex === 'number' && connected.has(node.id)) rootHasEdge.add(rootIndex);
  }
  const issues: Issue[] = [];
  doc.nodes.forEach((root, i) => {
    if (!rootHasEdge.has(i)) {
      issues.push(warning(formatPath(['nodes', i]), t.validation.isolatedRoot(root.id)));
    }
  });
  return issues;
}

/** Keys present in the raw input but dropped by the schema (Zod strips unknown keys). */
function unknownFieldWarnings(raw: unknown, parsed: unknown, path: PathSegment[]): Issue[] {
  const issues: Issue[] = [];
  const stack: { raw: unknown; parsed: unknown; path: PathSegment[] }[] = [{ raw, parsed, path }];
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) break;
    if (Array.isArray(entry.raw) && Array.isArray(entry.parsed)) {
      const parsedItems: unknown[] = entry.parsed;
      entry.raw.forEach((item: unknown, i) => {
        stack.push({ raw: item, parsed: parsedItems[i], path: [...entry.path, i] });
      });
    } else if (isRecord(entry.raw) && isRecord(entry.parsed)) {
      for (const key of Object.keys(entry.raw)) {
        const childPath = [...entry.path, key];
        if (!Object.hasOwn(entry.parsed, key)) {
          const formatted = formatPath(childPath);
          issues.push(warning(formatted, t.validation.unknownField(formatted)));
        } else {
          stack.push({ raw: entry.raw[key], parsed: entry.parsed[key], path: childPath });
        }
      }
    }
  }
  return issues.sort((a, b) => a.path.localeCompare(b.path));
}

function dropUnknownPositions(
  doc: SystemDoc,
  nodeIds: ReadonlySet<string>,
): { doc: SystemDoc; warnings: Issue[] } {
  const positions = doc.layout?.positions;
  if (!positions) return { doc, warnings: [] };
  const warnings: Issue[] = [];
  const kept: NonNullable<typeof positions> = {};
  for (const [id, position] of Object.entries(positions)) {
    if (nodeIds.has(id)) kept[id] = position;
    else
      warnings.push(
        warning(formatPath(['layout', 'positions', id]), t.validation.unknownPosition(id)),
      );
  }
  if (warnings.length === 0) return { doc, warnings };
  return { doc: { ...doc, layout: { ...doc.layout, positions: kept } }, warnings };
}

// ---------------------------------------------------------------------------------------------
// Entry points

/** Validates an already-parsed value as a SystemDoc (migration -> limits -> schema -> rules). */
export function validateSystemDoc(data: unknown): ValidationResult {
  const migrated = migrate(data);
  if (!migrated.ok) return migrated;
  const raw = migrated.value;
  if (!isRecord(raw)) return { ok: false, errors: [error('', t.validation.notAnObject)] };

  const preErrors = precheck(raw);
  if (preErrors.length > 0) return { ok: false, errors: preErrors };

  const parsed = SystemDocSchema.safeParse(raw, { reportInput: true });
  if (!parsed.success) return { ok: false, errors: schemaIssues(raw, parsed.error.issues) };

  const entries = walkNodes(parsed.data);
  const errors = semanticErrors(parsed.data, entries);
  if (errors.length > 0) return { ok: false, errors };

  const nodeIds = new Set(entries.map((e) => e.node.id));
  const positions = dropUnknownPositions(parsed.data, nodeIds);
  const warnings = [
    ...disconnectedStepWarnings(parsed.data),
    ...positions.warnings,
    ...isolatedRootWarnings(parsed.data, entries),
    ...unknownFieldWarnings(raw, parsed.data, []),
  ];
  return { ok: true, value: positions.doc, warnings };
}

/** Validates JSON text as a SystemDoc (size -> parse -> validateSystemDoc). */
export function validateSystemText(text: string): ValidationResult {
  const parsed = parseJsonText(text);
  if (!parsed.ok) return parsed;
  return validateSystemDoc(parsed.value);
}
