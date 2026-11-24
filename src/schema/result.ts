// Shared value types for expected failures (SPEC §16: errors are returned, not thrown).

export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  /** Location in the document, e.g. `edges[12].target`; empty string for the whole document. */
  path: string;
  /** Human-readable pt-BR message, naming the id involved when there is one. */
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Issue[] };

export function error(path: string, message: string): Issue {
  return { severity: 'error', path, message };
}

export function warning(path: string, message: string): Issue {
  return { severity: 'warning', path, message };
}

export type PathSegment = string | number;

/** Formats `['edges', 12, 'target']` as `edges[12].target`. */
export function formatPath(segments: readonly PathSegment[]): string {
  let out = '';
  for (const segment of segments) {
    if (typeof segment === 'number') out += `[${segment}]`;
    else out += out === '' ? segment : `.${segment}`;
  }
  return out;
}
