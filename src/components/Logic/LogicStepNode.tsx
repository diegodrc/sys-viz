import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronRight, Link2, Maximize2 } from 'lucide-react';
import { memo } from 'react';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';
import { stepStyle } from '../../theme/stepCategories';
import { Popover } from '../common/Popover';
import type { FollowInfo, LogicFlowNode } from './logicModel';

const stop = (event: React.SyntheticEvent): void => event.stopPropagation();

function FollowButton({ follow }: { follow: FollowInfo }) {
  const openLogic = useApp((s) => s.openLogic);
  const chip = 'btn nodrag nopan px-1.5 py-0.5 text-[11px]';
  const [only] = follow.options;
  if (follow.options.length === 0) {
    const reason = follow.unmappedName
      ? t.logic.followNone(follow.unmappedName)
      : t.logic.followNothing;
    // a wrapper carries the tooltip: disabled buttons do not show one in every browser
    return (
      <span title={reason} data-testid="follow-disabled">
        <button type="button" className={chip} disabled aria-label={reason}>
          {t.logic.follow(follow.unmappedName ?? '…')}
        </button>
      </span>
    );
  }
  if (follow.options.length === 1 && only) {
    return (
      <button
        type="button"
        className={`${chip} text-accent`}
        onClick={(event) => {
          stop(event);
          openLogic(only.edgeId, { append: true });
        }}
      >
        {t.logic.follow(only.label)}
      </button>
    );
  }
  return (
    <div className="nodrag nopan" onClick={stop}>
      <Popover
        label={t.logic.followChoose}
        align="left"
        triggerClassName="px-1.5 py-0.5 text-[11px] text-accent"
        trigger={
          <>
            {t.logic.followChoose}
            <ChevronRight size={12} aria-hidden />
          </>
        }
      >
        {(close) => (
          <ul className="flex flex-col gap-0.5">
            {follow.options.map((option) => (
              <li key={option.edgeId}>
                <button
                  type="button"
                  className="w-full rounded px-1 py-0.5 text-left hover:bg-surface-muted"
                  onClick={() => {
                    close();
                    openLogic(option.edgeId, { append: true });
                  }}
                >
                  {t.logic.follow(option.label)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </div>
  );
}

/** One logic step (SPEC §18.7): card by category; decisions as a hexagon with dashed outline. */
function LogicStepNodeView({ data, selected }: NodeProps<LogicFlowNode>) {
  const showEdgeOnMap = useApp((s) => s.showEdgeOnMap);
  const openStepSubprocess = useApp((s) => s.openStepSubprocess);
  const { step } = data;
  const style = stepStyle(step.category, step.outcome);
  const Icon = style.icon;
  const decision = step.category === 'decision';
  const assumed = step.confidence === 'assumed';
  const ring = selected ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : '';

  return (
    <div
      className={`relative flex h-full w-full flex-col justify-center gap-1 px-3 text-text ${decision ? 'px-8' : `rounded-lg border-2 bg-surface shadow-sm ${assumed ? 'border-dashed' : ''} ${ring}`} ${data.pulsing ? 'sv-pulse' : ''}`}
      style={decision ? undefined : { borderColor: style.color }}
      data-category={step.category}
      title={assumed ? t.canvas.assumedNode : undefined}
    >
      {decision && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon
            points="8,0 92,0 100,50 92,100 8,100 0,50"
            fill="var(--color-surface)"
            stroke={selected ? 'var(--color-accent)' : style.color}
            strokeWidth={selected ? 3 : 2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="sv-logic-handle"
      />
      <div className="relative flex min-w-0 items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${style.color}22`, color: style.color }}
          title={t.logic.categories[step.category]}
        >
          <Icon size={16} aria-hidden />
        </span>
        <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-tight">
          {step.title}
        </span>
      </div>
      {(data.edgeLabel !== undefined || data.subprocessName !== undefined || data.follow) && (
        <div className="relative flex min-w-0 flex-wrap items-center gap-1">
          {data.edgeLabel !== undefined && step.edgeId !== undefined && (
            <button
              type="button"
              className="nodrag nopan flex max-w-full items-center gap-0.5 truncate rounded border border-border bg-surface-muted px-1 text-[11px] text-text-muted hover:text-accent"
              title={t.logic.showEdge(data.edgeLabel)}
              aria-label={t.logic.showEdge(data.edgeLabel)}
              onClick={(event) => {
                stop(event);
                if (step.edgeId !== undefined) showEdgeOnMap(step.edgeId);
              }}
            >
              <Link2 size={11} aria-hidden />
              {data.edgeLabel}
            </button>
          )}
          {data.subprocessName !== undefined && (
            <button
              type="button"
              className="nodrag nopan flex items-center gap-0.5 rounded border border-border bg-surface-muted px-1 text-[11px] text-accent"
              title={t.logic.openSubprocess(data.subprocessName)}
              aria-label={t.logic.openSubprocess(data.subprocessName)}
              onClick={(event) => {
                stop(event);
                openStepSubprocess(step.id);
              }}
            >
              <Maximize2 size={11} aria-hidden />
              {data.subprocessName}
            </button>
          )}
          {data.follow && <FollowButton follow={data.follow} />}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="sv-logic-handle"
      />
    </div>
  );
}

export const LogicStepNode = memo(LogicStepNodeView);
