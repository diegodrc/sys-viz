import { ChevronLeft, ChevronRight, Workflow, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { stepLocation } from '../../graph/flowPath';
import { buildTree } from '../../graph/tree';
import { handlerOf } from '../../schema/logic';
import { t } from '../../i18n/pt-BR';
import { isTypingTarget } from '../../platform/keyboard';
import { useApp } from '../../store/context';

/** Step-by-step bar at the bottom of the canvas, with ←/→ shortcuts (SPEC §6.5). */
export function FlowBar() {
  const current = useApp((s) => s.current);
  const activeFlow = useApp((s) => s.activeFlow);
  const nextStep = useApp((s) => s.nextStep);
  const previousStep = useApp((s) => s.previousStep);
  const selectFlow = useApp((s) => s.selectFlow);
  const revealCurrentStep = useApp((s) => s.revealCurrentStep);
  const openLogic = useApp((s) => s.openLogic);
  const doc = current?.doc;
  const tree = useMemo(() => (doc ? buildTree(doc) : undefined), [doc]);
  const flow = activeFlow && doc?.flows?.find((f) => f.id === activeFlow.id);

  useEffect(() => {
    if (!flow) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextStep();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousStep();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flow, nextStep, previousStep]);

  if (!doc || !tree || !flow || !activeFlow || !current) return null;
  const total = flow.steps.length;
  const index = activeFlow.step;
  const step = index === undefined ? undefined : flow.steps[index];
  const edge = step ? doc.edges.find((e) => e.id === step.edgeId) : undefined;
  const nameOf = (id: string): string => tree.byId.get(id)?.name ?? id;
  const edgeText = edge
    ? (step?.note ??
      edge.label ??
      edge.protocol ??
      t.canvas.edgeLine('', nameOf(edge.source), nameOf(edge.target)))
    : '';
  const location = stepLocation(edge, tree, current.expanded);
  const hasLogic = edge !== undefined && handlerOf(doc, edge.id) !== undefined;

  return (
    <div
      role="toolbar"
      aria-label={t.flows.bar}
      className="absolute bottom-4 left-1/2 z-10 flex w-[min(44rem,calc(100%-2rem))] -translate-x-1/2 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn"
          onClick={previousStep}
          disabled={index === undefined || index === 0}
        >
          <ChevronLeft size={16} aria-hidden />
          <span className="max-[700px]:sr-only">{t.flows.previous}</span>
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm" aria-live="polite">
          {index === undefined
            ? t.flows.notStarted(flow.name, total)
            : t.flows.stepOf(index + 1, total, edgeText)}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={nextStep}
          disabled={index !== undefined && index >= total - 1}
        >
          <span className="max-[700px]:sr-only">{t.flows.next}</span>
          <ChevronRight size={16} aria-hidden />
        </button>
        {hasLogic && edge && (
          <button type="button" className="btn" onClick={() => openLogic(edge.id)}>
            <Workflow size={16} aria-hidden />
            <span className="max-[700px]:sr-only">{t.logic.viewLogic}</span>
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={t.flows.close}
          title={t.flows.close}
          onClick={() => selectFlow(undefined)}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      {location.kind === 'hidden' && (
        <p className="flex items-center justify-center gap-2 text-xs text-text-muted">
          {t.flows.hiddenStep(nameOf(location.containerId))}
          <button type="button" className="btn px-2 py-0.5 text-xs" onClick={revealCurrentStep}>
            {t.flows.reveal}
          </button>
        </p>
      )}
    </div>
  );
}
