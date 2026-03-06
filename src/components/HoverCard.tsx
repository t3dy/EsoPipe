/**
 * HoverCard — Wikipedia-style floating preview card.
 *
 * Rendered via a React Portal (fixed positioning) so it escapes
 * any overflow:hidden ancestors. Automatically repositions if
 * near the viewport bottom or right edge.
 *
 * Props from EntityLink:
 *   target      — the entity/alchemy/topic being previewed
 *   anchorRect  — bounding rect of the hovered element
 *   onMouseEnter / onMouseLeave — passed through for hover bridge
 *   data        — AppData for co-entity lookup
 */

import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Network } from 'lucide-react';
import type { LinkTarget } from '../types';
import type { AppData } from '../types';

const TYPE_DOT: Record<string, string> = {
  thinker:  'bg-amber-500',
  text:     'bg-blue-500',
  concept:  'bg-emerald-500',
  term:     'bg-purple-500',
  tool:     'bg-rose-500',
  alchemy:  'bg-yellow-500',
  topic:    'bg-sky-500',
};

interface Props {
  target: LinkTarget;
  anchorRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  data: AppData | null;
}

export function HoverCard({ target, anchorRect, onMouseEnter, onMouseLeave, data }: Props) {
  const navigate = useNavigate();

  // Co-entities for entity type targets
  const coEntities = (() => {
    if (target.type !== 'entity' || !data) return [];
    const detail = data.entityDetails[target.id];
    if (!detail) return [];
    return detail.co_entities
      .slice(0, 3)
      .map(ce => data.entities.find(e => e.id === ce.id))
      .filter(Boolean);
  })();

  // Positioning: appear below the anchor; flip up if too close to bottom
  const GAP = 8;
  const CARD_W = 280;
  const APPROX_H = 160;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchorRect.left;
  let top = anchorRect.bottom + GAP;

  // Prevent right overflow
  if (left + CARD_W > vw - 12) left = vw - CARD_W - 12;
  if (left < 8) left = 8;

  // Flip above if not enough room below
  if (top + APPROX_H > vh - 12) top = anchorRect.top - APPROX_H - GAP;

  const dotClass = TYPE_DOT[target.entityType ?? target.type] ?? 'bg-gray-400';

  const card = (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left,
        top,
        width: CARD_W,
        zIndex: 9999,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        padding: '12px',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}>
            {target.label}
          </div>
          <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {target.entityType ?? target.type}
          </div>
        </div>
      </div>

      {/* Blurb */}
      {target.blurb && (
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text)' }}>
          {target.blurb.slice(0, 160)}{target.blurb.length > 160 ? '…' : ''}
        </p>
      )}

      {/* Co-entities */}
      {coEntities.length > 0 && (
        <div className="mb-3">
          <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Often studied with
          </div>
          <div className="flex flex-wrap gap-1">
            {coEntities.map(e => e && (
              <span
                key={e.id}
                onClick={ev => { ev.stopPropagation(); navigate(`/entities/${e.id}`); }}
                className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                {e.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={ev => { ev.stopPropagation(); navigate(target.route); }}
          className="flex-1 text-xs py-1 rounded transition-colors"
          style={{ background: 'var(--primary)', color: 'var(--primary-text)' }}
        >
          View page
        </button>
        {target.type === 'entity' && (
          <button
            onClick={ev => { ev.stopPropagation(); navigate(`/graph?node=${target.id}&hops=1`); }}
            className="px-2 py-1 text-xs rounded transition-colors flex items-center gap-1"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            title="Open in graph (1-hop)"
          >
            <Network size={10} />
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(card, document.body);
}
