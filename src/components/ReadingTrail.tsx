/**
 * ReadingTrail — collapsible session navigation history strip.
 *
 * Mounted in Layout.tsx. Shows the last N pages visited this session.
 * Uses TrailContext (sessionStorage-backed).
 *
 * The strip is collapsed by default; a small toggle button in the
 * bottom-right reveals it as a horizontal scrollable bar.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useTrail } from '../contexts/TrailContext';

export function ReadingTrail() {
  const { trail, clear } = useTrail();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (trail.length === 0) return null;

  return (
    <div
      className="shrink-0"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-1.5 text-xs transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: 'var(--text-muted)' }}
      >
        <History size={12} />
        <span>Reading trail ({trail.length})</span>
        <span className="ml-auto">
          {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </span>
      </button>

      {/* Trail entries */}
      {expanded && (
        <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto">
          {trail.map((entry, i) => (
            <button
              key={`${entry.route}-${entry.timestamp}`}
              onClick={() => navigate(entry.route)}
              className="shrink-0 text-xs px-2 py-1 rounded border whitespace-nowrap transition-colors hover:border-[var(--primary)]"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border)',
                color: i === 0 ? 'var(--primary)' : 'var(--text)',
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={entry.label}
            >
              {i === 0 ? '● ' : `${trail.length - i}. `}{entry.label}
            </button>
          ))}
          <button
            onClick={clear}
            className="shrink-0 ml-2 p-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-muted)' }}
            title="Clear trail"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
