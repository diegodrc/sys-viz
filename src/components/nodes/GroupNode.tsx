import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown } from 'lucide-react';
import { memo } from 'react';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { NODE_TYPE_STYLES } from '../../theme/nodeTypes';
import type { SysFlowNode } from '../Canvas/flowModel';

/** Expanded group: container with header and its children inside (SPEC §5.2). */
function GroupNodeView({ id, data, selected }: NodeProps<SysFlowNode>) {
  const toggleExpanded = useApp((s) => s.toggleExpanded);
  const style = NODE_TYPE_STYLES[data.type];
  const Icon = style.icon;

  return (
    <div
      className={`sv-group h-full w-full rounded-xl border-2 ${data.assumed ? 'border-dashed' : ''} ${selected ? 'ring-2 ring-accent' : ''} ${data.emphasized ? 'sv-emphasized' : ''}`}
      style={{ borderColor: style.color, backgroundColor: `${style.color}0d` }}
      title={data.assumed ? t.canvas.assumedNode : undefined}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="sv-handle" />
      <div className="flex h-10 items-center gap-2 px-3" style={{ color: style.color }}>
        <Icon size={16} aria-hidden className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{data.name}</span>
        {data.hosting && (
          <span className="rounded bg-surface px-1 text-[10px] font-medium text-text-muted">
            {t.hosting.short[data.hosting.platform]}
          </span>
        )}
        <button
          type="button"
          className="nodrag icon-button size-6"
          aria-label={t.canvas.collapse(data.name)}
          title={t.canvas.collapse(data.name)}
          onClick={(event) => {
            event.stopPropagation();
            toggleExpanded(id);
          }}
        >
          <ChevronDown size={16} aria-hidden />
        </button>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} className="sv-handle" />
    </div>
  );
}

export const GroupNode = memo(GroupNodeView);
