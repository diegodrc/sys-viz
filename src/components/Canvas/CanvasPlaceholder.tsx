import { buildTree } from '../../graph/tree';
import { visibleNodeIds } from '../../graph/visibility';
import { t } from '../../i18n/pt-BR';
import { useApp } from '../../store/context';

/** Temporary canvas until the React Flow canvas lands (SPEC §14 step 5). */
export function CanvasPlaceholder() {
  const current = useApp((s) => s.current);
  if (!current) return null;
  const visible = visibleNodeIds(buildTree(current.doc), current.expanded);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-text-muted">
      <p className="font-medium text-text">
        {t.canvas.placeholder(current.doc.name, visible.length)}
      </p>
      <p className="text-sm">{t.canvas.pending}</p>
    </div>
  );
}
