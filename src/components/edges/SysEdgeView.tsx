import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react';
import { Workflow } from 'lucide-react';
import { memo } from 'react';
import { t } from '../../i18n/pt-BR';
import { midpoint, roundedPath, routeStillValid, type EdgeRoute } from '../../graph/edgeRoute';
import type { Box } from '../../graph/positions';
import type { SysFlowEdge } from '../Canvas/flowModel';

/** Absolute box of a node as React Flow currently has it (live during a drag). */
function liveBox(node: InternalNode | undefined): Box | undefined {
  if (!node) return undefined;
  const { x, y } = node.internals.positionAbsolute;
  return {
    x,
    y,
    width: node.width ?? node.measured.width ?? 0,
    height: node.height ?? node.measured.height ?? 0,
  };
}

/** ELK route as an SVG path, or undefined when an end moved (dragged or saved position). */
function routedPath(
  route: EdgeRoute | undefined,
  source: InternalNode | undefined,
  target: InternalNode | undefined,
): [string, number, number] | undefined {
  const s = liveBox(source);
  const t = liveBox(target);
  if (!route || !s || !t || !routeStillValid(route, s, t)) return undefined;
  const mid = midpoint(route.points);
  return [roundedPath(route.points), mid.x, mid.y];
}

/**
 * Rendered edge (SPEC §5.3): solid = sync, dashed = async, 50% = assumed, label on the path.
 * Flow (SPEC §6.5): path edges are highlighted, thicker and animated with a step badge; the
 * current step is emphasized; edges off the path are dimmed.
 */
function SysEdgeViewInner({
  id,
  source,
  target,
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
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  // ELK's orthogonal route avoids other edges (DECISIONS 2026-11-25); smoothstep is the fallback
  const [path, labelX, labelY] =
    routedPath(data?.route, sourceNode, targetNode) ??
    getSmoothStepPath({
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
        className={data?.pulsing ? 'sv-edge-pulse' : undefined}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: rendered?.async || onPath ? '6 4' : undefined,
          opacity,
        }}
      />
      {(data?.text || data?.badge || data?.hasLogic) && (
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
            {data.hasLogic && (
              <span
                className="flex items-center rounded border border-border bg-surface p-0.5 text-accent"
                title={t.logic.hasLogic}
                data-testid="logic-icon"
              >
                <Workflow size={12} aria-label={t.logic.hasLogic} />
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
