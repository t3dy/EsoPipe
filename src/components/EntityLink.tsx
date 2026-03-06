/**
 * EntityLink — a single clickable term in linkified text.
 *
 * Unambiguous terms (one target):
 *   Desktop — Hover → HoverCard after 300ms delay; Click → navigate
 *   Mobile  — First tap → show HoverCard preview; Second tap → navigate
 *
 * Ambiguous terms (multiple targets):
 *   Desktop — Click → DisambiguationPopover
 *   Mobile  — Tap → DisambiguationPopover
 *
 * The colored underline style is controlled by the `highlight` prop and the
 * entity type color scheme that matches the rest of the UI.
 */

import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HoverCard } from './HoverCard';
import { DisambiguationPopover } from './DisambiguationPopover';
import { useAppContext } from '../contexts/AppContext';
import type { LinkTarget } from '../types';

// Color scheme matches EntityDetail type badges and Graph node colors
const TYPE_UNDERLINE: Record<string, string> = {
  thinker:  'decoration-amber-500',
  text:     'decoration-blue-500',
  concept:  'decoration-emerald-500',
  term:     'decoration-purple-500',
  tool:     'decoration-rose-500',
  alchemy:  'decoration-yellow-500',
  topic:    'decoration-sky-500',
};

interface Props {
  targets: LinkTarget[];
  text: string;
  highlight: boolean;
}

export function EntityLink({ targets, text, highlight }: Props) {
  const navigate = useNavigate();
  const { data } = useAppContext();
  const spanRef = useRef<HTMLSpanElement>(null);

  const [hoverCardVisible, setHoverCardVisible] = useState(false);
  const [disambigOpen, setDisambigOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isSingle = targets.length === 1;
  const target = targets[0];

  // ── Hover logic (single target only, desktop) ─────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (!isSingle) return;
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => {
      if (spanRef.current) setAnchorRect(spanRef.current.getBoundingClientRect());
      setHoverCardVisible(true);
    }, 300);
  }, [isSingle]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setHoverCardVisible(false), 120);
  }, []);

  const handleCardMouseEnter = useCallback(() => clearTimeout(hideTimer.current), []);
  const handleCardMouseLeave = useCallback(() => {
    hideTimer.current = setTimeout(() => setHoverCardVisible(false), 120);
  }, []);

  // ── Click logic (desktop) ─────────────────────────────────────────────────
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSingle) {
      navigate(target.route);
    } else {
      if (spanRef.current) setAnchorRect(spanRef.current.getBoundingClientRect());
      setDisambigOpen(true);
    }
  }, [isSingle, navigate, target]);

  // ── Touch logic (mobile) ──────────────────────────────────────────────────
  // Single target: first tap = show preview, second tap = navigate.
  // Multiple targets: any tap opens disambiguation.
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isSingle) {
      // Multi-target: open disambig on first tap
      e.preventDefault();
      if (spanRef.current) setAnchorRect(spanRef.current.getBoundingClientRect());
      setDisambigOpen(true);
      return;
    }
    if (!hoverCardVisible) {
      // First tap: show preview, block navigation
      e.preventDefault();
      clearTimeout(hideTimer.current);
      clearTimeout(showTimer.current);
      if (spanRef.current) setAnchorRect(spanRef.current.getBoundingClientRect());
      setHoverCardVisible(true);
    }
    // Second tap: let the click event through → navigate (default browser behavior)
  }, [isSingle, hoverCardVisible]);

  // Choose underline color by entity type (first target wins for ambiguous)
  const underlineClass = highlight
    ? `underline decoration-dotted decoration-2 ${TYPE_UNDERLINE[target?.entityType ?? target?.type] ?? 'decoration-gray-400'} cursor-pointer hover:decoration-solid`
    : 'underline decoration-dotted decoration-2 decoration-gray-400 cursor-pointer hover:decoration-solid';

  return (
    <>
      <span
        ref={spanRef}
        data-testid={`entity-link-${targets[0]?.id}`}
        data-entity-type={target?.entityType ?? target?.type}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchEnd={handleTouchEnd}
        className={`inline transition-all ${underlineClass}`}
        style={{ fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit' }}
        title={isSingle ? target.label : `${targets.length} matches — click to choose`}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isSingle) navigate(target.route);
            else {
              if (spanRef.current) setAnchorRect(spanRef.current.getBoundingClientRect());
              setDisambigOpen(true);
            }
          }
        }}
      >
        {text}
      </span>

      {isSingle && hoverCardVisible && anchorRect && (
        <HoverCard
          target={target}
          anchorRect={anchorRect}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
          data={data}
        />
      )}

      {disambigOpen && anchorRect && (
        <DisambiguationPopover
          targets={targets}
          anchorRect={anchorRect}
          onClose={() => setDisambigOpen(false)}
        />
      )}
    </>
  );
}
