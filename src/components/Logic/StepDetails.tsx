import { Link2, Maximize2, Pencil } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n/pt-BR';
import type { GraphRef } from '../../schema/logic';
import type { LogicStep, SystemDoc } from '../../schema/system';
import { useApp } from '../../store/context';
import { FieldRow } from '../DetailsPanel/FieldRow';
import { IdRow } from '../DetailsPanel/IdRow';
import { StepForm } from './StepForm';

interface Props {
  doc: SystemDoc;
  graph: GraphRef;
  step: LogicStep;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-2 border-t border-border pt-1">
      <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-text">{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

/** Step details (SPEC §18.7): business, technical and links sections; "Editar" opens the form. */
export function StepDetails({ doc, graph, step }: Props) {
  const showEdgeOnMap = useApp((s) => s.showEdgeOnMap);
  const openStepSubprocess = useApp((s) => s.openStepSubprocess);
  const [editing, setEditing] = useState(false);
  const f = t.logic.fields;

  if (editing) {
    return <StepForm key={step.id} graph={graph} step={step} onDone={() => setEditing(false)} />;
  }

  const edge = step.edgeId === undefined ? undefined : doc.edges.find((e) => e.id === step.edgeId);
  const subprocess =
    step.subprocessId === undefined
      ? undefined
      : doc.logic?.subprocesses?.find((s) => s.id === step.subprocessId);
  const { source, ...metadata } = step.metadata ?? {};

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" className="btn" onClick={() => setEditing(true)}>
          <Pencil size={14} aria-hidden />
          {t.details.edit}
        </button>
      </div>
      <dl>
        <IdRow id={step.id} />
      </dl>
      <Section title={t.logic.sections.business}>
        <FieldRow label={f.title}>{step.title}</FieldRow>
        <FieldRow label={f.category}>{t.logic.categories[step.category]}</FieldRow>
        {step.category === 'end' && (
          <FieldRow label={f.outcome}>{t.logic.outcomes[step.outcome ?? 'success']}</FieldRow>
        )}
        <FieldRow label={t.details.fields.description}>{step.description}</FieldRow>
        <FieldRow label={f.fields}>
          {step.fields && step.fields.length > 0 && (
            <table className="w-full table-fixed text-left text-xs">
              <thead className="text-text-muted">
                <tr>
                  <th className="w-1/3 font-medium">{f.fieldName}</th>
                  <th className="font-medium">{f.fieldRole}</th>
                  <th className="font-medium">{f.fieldRule}</th>
                </tr>
              </thead>
              <tbody>
                {step.fields.map((field, i) => (
                  <tr key={`${field.name}-${i}`} className="align-top">
                    <td className="break-words font-mono">{field.name}</td>
                    <td>{t.logic.roles[field.role]}</td>
                    <td className="break-words">
                      {[field.rule, field.value && `= ${field.value}`, field.errorCode]
                        .filter(Boolean)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </FieldRow>
        <FieldRow label={t.details.fields.confidence}>
          {step.confidence === 'assumed'
            ? t.details.confidence.assumed
            : t.details.confidence.confirmed}
        </FieldRow>
      </Section>
      <Section title={t.logic.sections.technical}>
        <FieldRow label={f.technical}>{step.technical}</FieldRow>
        {source !== undefined && (
          <FieldRow label="source">
            <code className="font-mono text-xs">{source}</code>
          </FieldRow>
        )}
        <FieldRow label={t.details.fields.metadata}>
          {Object.keys(metadata).length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-2">
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-mono text-xs text-text-muted">{key}</dt>
                  <dd className="text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </FieldRow>
      </Section>
      <Section title={t.logic.sections.links}>
        <FieldRow label={f.edge}>
          {edge && (
            <button
              type="button"
              className="flex items-center gap-1 rounded px-1 text-left text-accent hover:bg-surface-muted"
              onClick={() => showEdgeOnMap(edge.id)}
            >
              <Link2 size={14} aria-hidden />
              {t.logic.showEdge(edge.label ?? edge.protocol ?? edge.id)}
            </button>
          )}
        </FieldRow>
        <FieldRow label={f.subprocess}>
          {subprocess && (
            <button
              type="button"
              className="flex items-center gap-1 rounded px-1 text-left text-accent hover:bg-surface-muted"
              onClick={() => openStepSubprocess(step.id)}
            >
              <Maximize2 size={14} aria-hidden />
              {t.logic.openSubprocess(subprocess.name)}
            </button>
          )}
        </FieldRow>
      </Section>
    </div>
  );
}
