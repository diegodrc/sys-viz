import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import { midpoint, roundedPath } from '../../graph/edgeRoute';
import type { LogicFlowEdge } from './logicModel';

/** Transition between logic steps (SPEC §18.7): ELK route, label on decision exits. */
function LogicEdgeViewInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<LogicFlowEdge>) {
  // logic steps cannot be dragged, so the ELK route always matches the boxes
  const route = data?.route;
  const mid = route ? midpoint(route.points) : undefined;
  const [path, labelX, labelY] =
    route && mid
      ? [roundedPath(route.points), mid.x, mid.y]
      : getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 8,
        });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, stroke: 'var(--color-text-muted)', strokeWidth: 1.5 }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <span
            className="nodrag nopan absolute rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] font-medium text-text"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              opacity: style?.opacity,
            }}
            data-testid="transition-label"
          >
            {data.label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const LogicEdgeView = memo(LogicEdgeViewInner);
