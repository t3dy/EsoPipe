/**
 * DisambiguationPopover — shown when a term maps to 2+ distinct targets.
 *
 * Renders a small popover listing all possible targets with type badges.
 * The user picks one to navigate. Closes on outside click or Escape.
 *
 * Rendered via React Portal (fixed positioning).
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { LinkTarget } from '../types';

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
  targets: LinkTarget[];
  anchorRect: DOMRect;
  onClose: () => void;
}

export function DisambiguationPopover({ targets, anchorRect, onClose }: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const GAP = 6;
  const POPOVER_W = 220;
  const vw = window.innerWidth;

  let left = anchorRect.left;
  let top = anchorRect.bottom + GAP;

  if (left + POPOVER_W > vw - 8) left = anchorRect.right - POPOVER_W;
  if (left < 8) left = 8;

  const popover = (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left,
        top,
        width: POPOVER_W,
        zIndex: 10000,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        padding: '6px',
      }}
    >
      <div className="text-[9px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: 'var(--text-muted)' }}>
        Which did you mean?
      </div>
      {targets.map((t, i) => {
        const dot = TYPE_DOT[t.entityType ?? t.type] ?? 'bg-gray-400';
        return (
          <button
            key={`${t.id}-${i}`}
            onClick={() => { onClose(); navigate(t.route); }}
            className="w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors hover:bg-[var(--bg-hover)]"
            style={{ display: 'flex' }}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-heading)' }}>{t.label}</div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {t.entityType ?? t.type}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  return createPortal(popover, document.body);
}
