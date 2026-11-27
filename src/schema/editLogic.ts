import { t } from '../i18n/pt-BR';
import {
  confidenceFrom,
  finish,
  metadataErrors,
  optional,
  toPairs,
  toRecord,
  withoutUndefined,
  type DraftResult,
  type FieldErrors,
  type PairDraft,
} from './edit';
import { sameGraph, type GraphRef } from './logic';
import {
  LogicStepSchema,
  type FieldRole,
  type Handler,
  type LogicStep,
  type Outcome,
  type StepCategory,
  type Subprocess,
  type SystemDoc,
} from './system';

// Logic edit forms (SPEC §18.7): properties only — ids, edgeId, subprocessId and transitions are
// never edited here. Pure.

export interface FieldDraft {
  name: string;
  role: FieldRole;
  rule: string;
  value: string;
  errorCode: string;
}

export interface StepDraft {
  title: string;
  category: StepCategory;
  description: string;
  technical: string;
  /** Only kept when the category is `end`. */
  outcome: Outcome | '';
  fields: FieldDraft[];
  metadata: PairDraft[];
  assumed: boolean;
}

export interface GraphInfoDraft {
  name: string;
  description: string;
}

export function stepToDraft(step: LogicStep): StepDraft {
  return {
    title: step.title,
    category: step.category,
    description: step.description ?? '',
    technical: step.technical ?? '',
    outcome: step.outcome ?? '',
    fields: (step.fields ?? []).map((f) => ({
      name: f.name,
      role: f.role,
      rule: f.rule ?? '',
      value: f.value ?? '',
      errorCode: f.errorCode ?? '',
    })),
    metadata: toPairs(step.metadata),
    assumed: step.confidence === 'assumed',
  };
}

function fieldErrors(fields: readonly FieldDraft[]): FieldErrors {
  const errors: FieldErrors = {};
  fields.forEach((field, i) => {
    if (field.name.trim() === '') errors[`fields.${i}.name`] = t.logic.edit.emptyFieldName;
  });
  return errors;
}

export function draftToStep(original: LogicStep, draft: StepDraft): DraftResult<LogicStep> {
  const candidate = withoutUndefined({
    id: original.id,
    category: draft.category,
    title: draft.title.trim(),
    description: optional(draft.description),
    technical: optional(draft.technical),
    edgeId: original.edgeId,
    subprocessId: original.subprocessId,
    outcome: draft.category === 'end' && draft.outcome !== '' ? draft.outcome : undefined,
    fields:
      draft.fields.length > 0
        ? draft.fields.map((f) =>
            withoutUndefined({
              name: f.name.trim(),
              role: f.role,
              rule: optional(f.rule),
              value: optional(f.value),
              errorCode: optional(f.errorCode),
            }),
          )
        : undefined,
    metadata: toRecord(draft.metadata),
    confidence: confidenceFrom(draft.assumed, original.confidence),
  });
  return finish(candidate, LogicStepSchema, {
    ...fieldErrors(draft.fields),
    ...metadataErrors(draft.metadata),
  });
}

export function graphInfoToDraft(graph: Handler | Subprocess): GraphInfoDraft {
  return { name: graph.name ?? '', description: graph.description ?? '' };
}

/** Subprocess names are required; handler names are optional (SPEC §18.4). */
export function draftToGraphInfo(
  ref: GraphRef,
  draft: GraphInfoDraft,
): DraftResult<{ name: string | undefined; description: string | undefined }> {
  const name = optional(draft.name.trim());
  if (ref.kind === 'subprocess' && name === undefined) {
    return { ok: false, errors: { name: t.validation.schema.tooShortString(1) } };
  }
  return { ok: true, value: { name, description: optional(draft.description) } };
}

// ---------------------------------------------------------------------------------------------
// applying edits (immutable)

function mapGraphs(
  doc: SystemDoc,
  ref: GraphRef,
  changeHandler: (handler: Handler) => Handler,
  changeSubprocess: (subprocess: Subprocess) => Subprocess,
): SystemDoc {
  const logic = doc.logic;
  if (!logic) return doc;
  const next = { ...logic };
  if (logic.handlers) {
    next.handlers = logic.handlers.map((h) =>
      sameGraph(ref, { kind: 'handler', edgeId: h.edgeId }) ? changeHandler(h) : h,
    );
  }
  if (logic.subprocesses) {
    next.subprocesses = logic.subprocesses.map((sp) =>
      sameGraph(ref, { kind: 'subprocess', id: sp.id }) ? changeSubprocess(sp) : sp,
    );
  }
  return { ...doc, logic: next };
}

export function replaceStep(doc: SystemDoc, ref: GraphRef, step: LogicStep): SystemDoc {
  const swap = (steps: LogicStep[]): LogicStep[] => steps.map((s) => (s.id === step.id ? step : s));
  return mapGraphs(
    doc,
    ref,
    (h) => ({ ...h, steps: swap(h.steps) }),
    (sp) => ({ ...sp, steps: swap(sp.steps) }),
  );
}

export function replaceGraphInfo(
  doc: SystemDoc,
  ref: GraphRef,
  info: { name: string | undefined; description: string | undefined },
): SystemDoc {
  return mapGraphs(
    doc,
    ref,
    (h) => withoutUndefined({ ...h, name: info.name, description: info.description }),
    (sp) => withoutUndefined({ ...sp, name: info.name ?? sp.name, description: info.description }),
  );
}
