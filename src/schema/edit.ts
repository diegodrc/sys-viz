import type { z } from 'zod';
import { t } from '../i18n/pt-BR';
import {
  FlowSchema,
  SysEdgeSchema,
  SysNodeSchema,
  type Confidence,
  type EdgeMode,
  type Flow,
  type HostingPlatform,
  type NodeType,
  type SysEdge,
  type SysNode,
  type SystemDoc,
} from './system';
import { issueMessage } from './validate';

// Edit forms (SPEC §6.6): plain string drafts <-> schema objects. Empty inputs become absent
// optional fields so that untouched documents export exactly as imported. Pure.

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface PairDraft {
  key: string;
  value: string;
}

/** Field path -> pt-BR message, e.g. `name`, `links.1.url`, `metadata.0.key`. */
export type FieldErrors = Record<string, string>;

export type DraftResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export interface NodeDraft {
  name: string;
  type: NodeType;
  description: string;
  technology: string;
  platform: HostingPlatform | '';
  cluster: string;
  namespace: string;
  hostingDetails: string;
  owner: string;
  links: PairDraft[];
  metadata: PairDraft[];
  assumed: boolean;
}

export interface EdgeDraft {
  protocol: string;
  mode: EdgeMode | '';
  label: string;
  description: string;
  metadata: PairDraft[];
  assumed: boolean;
}

export interface FlowDraft {
  name: string;
  description: string;
}

export interface SystemDraft {
  name: string;
  description: string;
}

// ---------------------------------------------------------------------------------------------
// helpers

export const optional = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

export function withoutUndefined<T extends object>(value: T): T {
  // drops keys whose value is undefined so absent fields stay absent in the document
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T; // keys only removed
}

export function toPairs(record: Record<string, string> | undefined): PairDraft[] {
  return Object.entries(record ?? {}).map(([key, value]) => ({ key, value }));
}

export function metadataErrors(pairs: readonly PairDraft[]): FieldErrors {
  const errors: FieldErrors = {};
  const seen = new Set<string>();
  pairs.forEach((pair, i) => {
    const key = pair.key.trim();
    if (key === '') errors[`metadata.${i}.key`] = t.edit.emptyKey;
    else if (FORBIDDEN_KEYS.has(key)) errors[`metadata.${i}.key`] = t.edit.forbiddenKey(key);
    else if (seen.has(key)) errors[`metadata.${i}.key`] = t.edit.duplicateKey(key);
    seen.add(key);
  });
  return errors;
}

export function toRecord(pairs: readonly PairDraft[]): Record<string, string> | undefined {
  if (pairs.length === 0) return undefined;
  const record: Record<string, string> = {};
  for (const pair of pairs) record[pair.key.trim()] = pair.value;
  return record;
}

function zodErrors(issues: readonly z.core.$ZodIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.');
    errors[key] ??= issueMessage(issue);
  }
  return errors;
}

/** Keeps an explicit "confirmed" if the original had it; otherwise "confirmed" stays absent. */
export function confidenceFrom(
  assumed: boolean,
  original: Confidence | undefined,
): Confidence | undefined {
  if (assumed) return 'assumed';
  return original === 'confirmed' ? 'confirmed' : undefined;
}

export function finish<T>(
  candidate: unknown,
  schema: z.ZodType<T>,
  extra: FieldErrors,
): DraftResult<T> {
  const parsed = schema.safeParse(candidate, { reportInput: true });
  const errors = { ...(parsed.success ? {} : zodErrors(parsed.error.issues)), ...extra };
  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, value: parsed.data };
}

// ---------------------------------------------------------------------------------------------
// nodes

export function nodeToDraft(node: SysNode): NodeDraft {
  return {
    name: node.name,
    type: node.type,
    description: node.description ?? '',
    technology: node.technology ?? '',
    platform: node.hosting?.platform ?? '',
    cluster: node.hosting?.cluster ?? '',
    namespace: node.hosting?.namespace ?? '',
    hostingDetails: node.hosting?.details ?? '',
    owner: node.owner ?? '',
    links: (node.links ?? []).map((l) => ({ key: l.label, value: l.url })),
    metadata: toPairs(node.metadata),
    assumed: node.confidence === 'assumed',
  };
}

export function draftToNode(original: SysNode, draft: NodeDraft): DraftResult<SysNode> {
  const hosting =
    draft.platform === ''
      ? undefined
      : withoutUndefined({
          platform: draft.platform,
          cluster: optional(draft.cluster),
          namespace: optional(draft.namespace),
          details: optional(draft.hostingDetails),
        });
  const candidate = withoutUndefined({
    id: original.id,
    name: draft.name.trim(),
    type: draft.type,
    description: optional(draft.description),
    technology: optional(draft.technology),
    hosting,
    owner: optional(draft.owner),
    links:
      draft.links.length > 0
        ? draft.links.map((l) => ({ label: l.key, url: l.value.trim() }))
        : undefined,
    metadata: toRecord(draft.metadata),
    confidence: confidenceFrom(draft.assumed, original.confidence),
    children: original.children,
  });
  return finish(candidate, SysNodeSchema, metadataErrors(draft.metadata));
}

// ---------------------------------------------------------------------------------------------
// edges

export function edgeToDraft(edge: SysEdge): EdgeDraft {
  return {
    protocol: edge.protocol ?? '',
    mode: edge.mode ?? '',
    label: edge.label ?? '',
    description: edge.description ?? '',
    metadata: toPairs(edge.metadata),
    assumed: edge.confidence === 'assumed',
  };
}

export function draftToEdge(original: SysEdge, draft: EdgeDraft): DraftResult<SysEdge> {
  const candidate = withoutUndefined({
    id: original.id,
    source: original.source,
    target: original.target,
    protocol: optional(draft.protocol),
    mode: draft.mode === '' ? undefined : draft.mode,
    label: optional(draft.label),
    description: optional(draft.description),
    metadata: toRecord(draft.metadata),
    confidence: confidenceFrom(draft.assumed, original.confidence),
  });
  return finish(candidate, SysEdgeSchema, metadataErrors(draft.metadata));
}

// ---------------------------------------------------------------------------------------------
// flows and system

export function flowToDraft(flow: Flow): FlowDraft {
  return { name: flow.name, description: flow.description ?? '' };
}

export function draftToFlow(original: Flow, draft: FlowDraft): DraftResult<Flow> {
  const candidate = withoutUndefined({
    ...original,
    name: draft.name.trim(),
    description: optional(draft.description),
  });
  return finish(candidate, FlowSchema, {});
}

export function systemToDraft(doc: SystemDoc): SystemDraft {
  return { name: doc.name, description: doc.description ?? '' };
}

export function draftToSystemInfo(
  draft: SystemDraft,
): DraftResult<{ name: string; description: string | undefined }> {
  const name = draft.name.trim();
  if (name === '') return { ok: false, errors: { name: t.validation.schema.tooShortString(1) } };
  return { ok: true, value: { name, description: optional(draft.description) } };
}

// ---------------------------------------------------------------------------------------------
// applying edits to a document (immutable)

function mapNodes(nodes: readonly SysNode[], id: string, replacement: SysNode): SysNode[] {
  return nodes.map((node) => {
    if (node.id === id) return replacement;
    if (!node.children) return node;
    return { ...node, children: mapNodes(node.children, id, replacement) };
  });
}

export function replaceNode(doc: SystemDoc, node: SysNode): SystemDoc {
  return { ...doc, nodes: mapNodes(doc.nodes, node.id, node) };
}

export function replaceEdge(doc: SystemDoc, edge: SysEdge): SystemDoc {
  return { ...doc, edges: doc.edges.map((e) => (e.id === edge.id ? edge : e)) };
}

export function replaceFlow(doc: SystemDoc, flow: Flow): SystemDoc {
  return { ...doc, flows: (doc.flows ?? []).map((f) => (f.id === flow.id ? flow : f)) };
}

export function replaceSystemInfo(
  doc: SystemDoc,
  info: { name: string; description: string | undefined },
): SystemDoc {
  const next: SystemDoc = { ...doc, name: info.name };
  if (info.description === undefined) delete next.description;
  else next.description = info.description;
  return next;
}
