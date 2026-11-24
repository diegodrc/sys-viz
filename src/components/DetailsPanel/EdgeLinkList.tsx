import { t } from '../../i18n/pt-BR';
import type { SysEdge } from '../../schema/system';
import { useApp } from '../../store/context';

interface Props {
  edges: readonly SysEdge[];
  /** Node id -> display name. */
  nameOf: (id: string) => string;
  /** Optional prefix per item, e.g. step numbers. */
  numbered?: boolean;
  notes?: readonly (string | undefined)[];
}

/** Clickable list of original edges; clicking selects the edge (SPEC §6.6). */
export function EdgeLinkList({ edges, nameOf, numbered, notes }: Props) {
  const select = useApp((s) => s.select);
  if (edges.length === 0) return <p className="text-sm text-text-muted">{t.details.noItems}</p>;
  return (
    <ul className="flex flex-col gap-0.5">
      {edges.map((edge, i) => {
        const summary = t.details.edgeSummary(
          edge.label ?? edge.protocol ?? '',
          nameOf(edge.source),
          nameOf(edge.target),
        );
        const note = notes?.[i];
        return (
          <li key={`${edge.id}-${i}`}>
            <button
              type="button"
              className="w-full rounded px-1 py-0.5 text-left text-sm hover:bg-surface-muted"
              onClick={() => select({ kind: 'docEdge', id: edge.id })}
            >
              {numbered ? t.details.stepItem(i + 1, summary) : summary}
              {note && <span className="block text-xs text-text-muted">{note}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
