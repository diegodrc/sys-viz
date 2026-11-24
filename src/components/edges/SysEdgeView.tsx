import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import type { SysFlowEdge } from '../Canvas/flowModel';

/** Rendered edge (SPEC §5.3): solid = sync, dashed = async, 50% = assumed, label on the path. */
function SysEdgeViewInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<SysFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });
  const rendered = data?.rendered;
  const opacity = rendered?.assumed ? 0.5 : 1;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? 'var(--color-accent)' : 'var(--color-text-muted)',
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: rendered?.async ? '6 4' : undefined,
          opacity,
        }}
      />
      {data?.text && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-text"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              opacity,
              whiteSpace: 'pre',
            }}
            title={data.tooltip}
          >
            {data.text}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SysEdgeView = memo(SysEdgeViewInner);
