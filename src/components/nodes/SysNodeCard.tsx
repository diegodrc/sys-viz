import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { t } from '../../i18n/pt-BR';
import { NODE_TYPE_STYLES } from '../../theme/nodeTypes';
import type { SysFlowNode } from '../Canvas/flowModel';

/** Leaf node or collapsed group card (~220×64, SPEC §5.2). */
function SysNodeCardView({ data, selected }: NodeProps<SysFlowNode>) {
  const style = NODE_TYPE_STYLES[data.type];
  const Icon = style.icon;
  const secondary = data.technology ?? t.nodeTypes[data.type];

  return (
    <div
      className={`sv-node flex h-full w-full items-center gap-2 rounded-lg border-2 bg-surface px-2.5 text-text shadow-sm ${data.assumed ? 'border-dashed' : ''} ${selected ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''} ${data.emphasized ? 'sv-emphasized' : ''}`}
      style={{ borderColor: style.color }}
      title={data.assumed ? t.canvas.assumedNode : undefined}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="sv-handle" />
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${style.color}22`, color: style.color }}
      >
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight">{data.name}</span>
        <span className="block truncate text-xs text-text-muted">{secondary}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {data.hosting && (
          <span
            className="rounded bg-surface-muted px-1 text-[10px] font-medium text-text-muted"
            title={t.hosting.title(data.hosting.platform)}
          >
            {t.hosting.short[data.hosting.platform]}
          </span>
        )}
        {data.isGroup && (
          <span
            className="rounded px-1 text-[10px] font-semibold text-white"
            style={{ backgroundColor: style.color }}
            title={t.canvas.descendantsTitle(data.descendantCount)}
          >
            {t.canvas.descendants(data.descendantCount)}
          </span>
        )}
      </span>
      <Handle type="source" position={Position.Right} isConnectable={false} className="sv-handle" />
    </div>
  );
}

export const SysNodeCard = memo(SysNodeCardView);
