import type { GraphPlace } from '../../graph/logic';
import type { TreeIndex } from '../../graph/tree';
import { t } from '../../i18n/pt-BR';
import { handlerName } from '../../schema/logic';
import type { SystemDoc } from '../../schema/system';
import type { LogicLevel } from '../../store/appStore';

/** `API Validação › POST /validacoes` or `Subprocesso Calcula aprovação` (SPEC §18.7, §18.9). */
export function placeLabel(place: GraphPlace): string {
  return place.kind === 'handler'
    ? [place.nodeName, place.handlerName].filter(Boolean).join(t.search.pathSeparator)
    : t.logic.subprocessTrail(place.name);
}

/** Breadcrumb text of one trail level (SPEC §18.7). */
export function levelLabel(doc: SystemDoc, tree: TreeIndex, level: LogicLevel): string {
  if (level.kind === 'subprocess') {
    const name = doc.logic?.subprocesses?.find((s) => s.id === level.id)?.name ?? level.id;
    // a subprocess opened from a step reads as a sub-level; opened alone it says what it is
    return level.fromStepId === undefined ? t.logic.subprocessTrail(name) : name;
  }
  const handler = doc.logic?.handlers?.find((h) => h.edgeId === level.edgeId);
  const target = doc.edges.find((e) => e.id === level.edgeId)?.target;
  const node = target === undefined ? undefined : tree.byId.get(target)?.name;
  const name = handler ? handlerName(doc, handler) : level.edgeId;
  return [node, name].filter(Boolean).join(t.search.pathSeparator);
}
