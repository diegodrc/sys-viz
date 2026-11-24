import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import type { SysFlowEdge } from '../Canvas/flowModel';

/**
 * Rendered edge (SPEC §5.3): solid = sync, dashed = async, 50% = assumed, label on the path.
 * Flow (SPEC §6.5): path edges are highlighted, thicker and animated with a step badge; the
 * current step is emphasized; edges off the path are dimmed.
 */
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
  const flowState = data?.flowState ?? 'none';
  const onPath = flowState === 'path' || flowState === 'current';
  const baseOpacity = rendered?.assumed ? 0.5 : 1;
  // combined dimming keeps the smaller opacity (SPEC §6.4), never the product; edges on the
  // flow path ignore the "assumed" 50% so the highlight stays readable
  const dimOpacity = data?.dimOpacity ?? 1;
  const opacity = Math.min(dimOpacity, onPath ? 1 : baseOpacity);
  let stroke = 'var(--color-text-muted)';
  let strokeWidth = 1.5;
  if (onPath) {
    stroke = 'var(--color-highlight)';
    strokeWidth = flowState === 'current' ? 4.5 : 3;
  } else if (selected) {
    stroke = 'var(--color-accent)';
    strokeWidth = 2.5;
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: rendered?.async || onPath ? '6 4' : undefined,
          opacity,
        }}
      />
      {(data?.text || data?.badge) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              opacity,
              zIndex: onPath ? 2 : 1,
            }}
            title={data.tooltip}
          >
            {data.badge && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold text-white ${flowState === 'current' ? 'ring-2 ring-highlight ring-offset-1' : ''}`}
                style={{ backgroundColor: 'var(--color-highlight)' }}
                data-testid="step-badge"
              >
                {data.badge}
              </span>
            )}
            {data.text && (
              <span
                className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-text"
                style={{ whiteSpace: 'pre' }}
              >
                {data.text}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SysEdgeView = memo(SysEdgeViewInner);
