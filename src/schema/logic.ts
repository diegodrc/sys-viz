import type { PathSegment } from './result';
import type { Handler, LogicStep, Subprocess, SystemDoc } from './system';

// Shared helpers over the business-logic section (SPEC §18). Pure.

/** A logic graph: the handler of an incoming edge, or a shared subprocess. */
export type GraphRef = { kind: 'handler'; edgeId: string } | { kind: 'subprocess'; id: string };

export interface GraphEntry {
  ref: GraphRef;
  graph: Handler | Subprocess;
  /** Location in the document, e.g. `['logic', 'handlers', 0]`. */
  path: PathSegment[];
}

/** Every handler, then every subprocess, in document order. */
export function listGraphs(doc: SystemDoc): GraphEntry[] {
  const handlers = (doc.logic?.handlers ?? []).map((graph, i): GraphEntry => ({
    ref: { kind: 'handler', edgeId: graph.edgeId },
    graph,
    path: ['logic', 'handlers', i],
  }));
  const subprocesses = (doc.logic?.subprocesses ?? []).map((graph, i): GraphEntry => ({
    ref: { kind: 'subprocess', id: graph.id },
    graph,
    path: ['logic', 'subprocesses', i],
  }));
  return [...handlers, ...subprocesses];
}

export function sameGraph(a: GraphRef, b: GraphRef): boolean {
  if (a.kind === 'handler' && b.kind === 'handler') return a.edgeId === b.edgeId;
  if (a.kind === 'subprocess' && b.kind === 'subprocess') return a.id === b.id;
  return false;
}

export function graphOf(doc: SystemDoc, ref: GraphRef): Handler | Subprocess | undefined {
  return ref.kind === 'handler'
    ? doc.logic?.handlers?.find((h) => h.edgeId === ref.edgeId)
    : doc.logic?.subprocesses?.find((s) => s.id === ref.id);
}

export function handlerOf(doc: SystemDoc, edgeId: string): Handler | undefined {
  return doc.logic?.handlers?.find((h) => h.edgeId === edgeId);
}

export function stepOf(graph: Handler | Subprocess, stepId: string): LogicStep | undefined {
  return graph.steps.find((s) => s.id === stepId);
}

/** Display name of a handler: its name, else the edge label, else `metadata.endpoint`. */
export function handlerName(doc: SystemDoc, handler: Handler): string {
  if (handler.name) return handler.name;
  const edge = doc.edges.find((e) => e.id === handler.edgeId);
  return edge?.label ?? edge?.metadata?.endpoint ?? handler.edgeId;
}
