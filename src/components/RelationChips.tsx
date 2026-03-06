/**
 * RelationChips — displays S→P→O edge chips for an entity.
 *
 * Renders all edges in data.edges where source === entityId OR target === entityId.
 * Each chip shows: [SourceLabel] —[type]→ [TargetLabel]
 * Both labels are clickable (navigate to the entity's page).
 *
 * Shows nothing if the entity has no edges.
 *
 * Usage:
 *   <RelationChips entityId={entity.id} />
 */

import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

const EDGE_TYPE_COLOR: Record<string, string> = {
  'uses':         'text-emerald-500',
  'explains':     'text-blue-500',
  'compares':     'text-purple-500',
  'derived-from': 'text-amber-500',
  'mentions':     'text-gray-400',
};

interface Props {
  entityId: string;
}

export function RelationChips({ entityId }: Props) {
  const navigate = useNavigate();
  const { data } = useAppContext();

  if (!data) return null;

  const edges = data.edges.filter(
    e => e.source === entityId || e.target === entityId
  );

  if (edges.length === 0) return null;

  function entityLabel(id: string) {
    const e = data!.entities.find(x => x.id === id);
    return e?.label ?? id;
  }

  function goToEntity(id: string) {
    const isEntity = data!.entities.some(x => x.id === id);
    if (isEntity) navigate(`/entities/${id}`);
  }

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--primary)' }}>
        Relationships
      </h2>
      <div className="flex flex-wrap gap-2">
        {edges.map(edge => {
          const provNote = edge.provenance?.source_conv_id
            ? `Source: conv #${edge.provenance.source_conv_id}`
            : undefined;

          return (
            <div
              key={edge.id}
              className="inline-flex items-center gap-1 text-xs border rounded-full px-2 py-1"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              title={provNote ?? edge.notes}
            >
              <button
                onClick={() => goToEntity(edge.source)}
                className="hover:underline font-medium"
                style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-body)' }}
              >
                {entityLabel(edge.source)}
              </button>

              <ArrowRight size={10} className={`mx-0.5 ${EDGE_TYPE_COLOR[edge.type] ?? 'text-gray-400'}`} />

              <span className={`text-[10px] font-mono ${EDGE_TYPE_COLOR[edge.type] ?? 'text-gray-400'}`}>
                {edge.type}
              </span>

              <ArrowRight size={10} className="mx-0.5 opacity-30" />

              <button
                onClick={() => goToEntity(edge.target)}
                className="hover:underline font-medium"
                style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-body)' }}
              >
                {entityLabel(edge.target)}
              </button>

              {provNote && (
                <span className="ml-1 text-[9px] opacity-50">↗</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
