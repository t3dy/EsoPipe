/**
 * MoreLikeThis — "You might also explore" recommendations.
 *
 * For an entity X: uses entity_details co_entities (already computed from
 * shared conversation counts) to surface similar entities.
 * Excludes entities already shown in the co-occurrence sidebar.
 *
 * For a topic: matches entities by overlapping tags (simple set overlap).
 *
 * Usage:
 *   <MoreLikeThis entityId="thinker_ficino" limit={4} />
 *   <MoreLikeThis topicTags={['neoplatonism','renaissance']} limit={4} />
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';

const TYPE_DOT: Record<string, string> = {
  thinker:  'bg-amber-500',
  text:     'bg-blue-500',
  concept:  'bg-emerald-500',
  term:     'bg-purple-500',
  tool:     'bg-rose-500',
};

interface Props {
  entityId?: string;
  topicTags?: string[];
  limit?: number;
}

export function MoreLikeThis({ entityId, topicTags, limit = 5 }: Props) {
  const navigate = useNavigate();
  const { data } = useAppContext();

  const suggestions = useMemo(() => {
    if (!data) return [];

    if (entityId) {
      const detail = data.entityDetails[entityId];
      if (!detail) return [];
      // co_entities already sorted by shared count descending
      return detail.co_entities
        .slice(0, limit + 2)
        .map(ce => data.entities.find(e => e.id === ce.id))
        .filter(Boolean)
        .slice(0, limit);
    }

    if (topicTags && topicTags.length > 0) {
      const tagSet = new Set(topicTags.map(t => t.toLowerCase()));
      return data.entities
        .map(e => ({
          entity: e,
          overlap: e.tags.filter(t => tagSet.has(t.toLowerCase())).length,
        }))
        .filter(x => x.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap)
        .slice(0, limit)
        .map(x => x.entity);
    }

    return [];
  }, [data, entityId, topicTags, limit]);

  if (suggestions.length === 0) return null;

  return (
    <section className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} style={{ color: 'var(--primary)' }} />
        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--primary)' }}>
          You might also explore
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map(e => e && (
          <button
            key={e.id}
            onClick={() => navigate(`/entities/${e.id}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:border-[var(--primary)] text-left"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[e.type] ?? 'bg-gray-400'}`} />
            <div>
              <div className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>{e.label}</div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{e.type}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
