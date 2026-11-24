import { Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TreeIndex } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import type { SystemDoc } from '../../schema/system';
import { useApp } from '../../store/context';
import { EdgeLinkList } from './EdgeLinkList';
import { FieldRow } from './FieldRow';
import { IdRow } from './IdRow';
import { NodeForm } from './NodeForm';
import { SafeLink } from './SafeLink';

interface Props {
  doc: SystemDoc;
  tree: TreeIndex;
  nodeId: string;
}

/** Node details: read mode with all fields; "Editar" switches to the form (SPEC §6.6). */
export function NodeDetails({ doc, tree, nodeId }: Props) {
  const focusNode = useApp((s) => s.focusNode);
  const [editing, setEditing] = useState(false);
  const node = tree.byId.get(nodeId);
  const nameOf = (id: string): string => tree.byId.get(id)?.name ?? id;
  const incoming = useMemo(() => doc.edges.filter((e) => e.target === nodeId), [doc, nodeId]);
  const outgoing = useMemo(() => doc.edges.filter((e) => e.source === nodeId), [doc, nodeId]);
  if (!node) return null;
  const f = t.details.fields;

  if (editing) return <NodeForm key={node.id} node={node} onDone={() => setEditing(false)} />;

  const hosting = node.hosting;
  const hostingText = hosting
    ? [t.details.platforms[hosting.platform], hosting.cluster, hosting.namespace, hosting.details]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" className="btn" onClick={() => setEditing(true)}>
          <Pencil size={14} aria-hidden />
          {t.details.edit}
        </button>
      </div>
      <dl>
        <IdRow id={node.id} />
        <FieldRow label={f.name}>{node.name}</FieldRow>
        <FieldRow label={f.type}>{t.nodeTypes[node.type]}</FieldRow>
        <FieldRow label={f.description}>{node.description}</FieldRow>
        <FieldRow label={f.technology}>{node.technology}</FieldRow>
        <FieldRow label={f.hosting}>{hostingText}</FieldRow>
        <FieldRow label={f.owner}>{node.owner}</FieldRow>
        <FieldRow label={f.links}>
          {node.links && node.links.length > 0 && (
            <ul>
              {node.links.map((link, i) => (
                <li key={i}>
                  <SafeLink label={link.label} url={link.url} />
                </li>
              ))}
            </ul>
          )}
        </FieldRow>
        <FieldRow label={f.metadata}>
          {node.metadata && Object.keys(node.metadata).length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-2">
              {Object.entries(node.metadata).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-xs text-text-muted">{key}</dt>
                  <dd className="text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </FieldRow>
        <FieldRow label={f.confidence}>
          {node.confidence === 'assumed'
            ? t.details.confidence.assumed
            : t.details.confidence.confirmed}
        </FieldRow>
        <FieldRow label={f.children}>
          {tree.childIds(node.id).length > 0 && (
            <ul>
              {tree.childIds(node.id).map((child) => (
                <li key={child}>
                  <button
                    type="button"
                    className="rounded px-1 py-0.5 text-left text-sm text-accent hover:bg-surface-muted"
                    onClick={() => focusNode(child)}
                  >
                    {nameOf(child)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FieldRow>
      </dl>
      <h3 className="mt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        {f.incoming}
      </h3>
      <EdgeLinkList edges={incoming} nameOf={nameOf} />
      <h3 className="mt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        {f.outgoing}
      </h3>
      <EdgeLinkList edges={outgoing} nameOf={nameOf} />
    </div>
  );
}
