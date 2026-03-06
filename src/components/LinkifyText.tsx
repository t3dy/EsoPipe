/**
 * LinkifyText — renders plain text with entity/alchemy/topic terms hyperlinked.
 *
 * Props:
 *   text        — the string to linkify (plain text, not HTML)
 *   highlight   — whether to apply type-colored underlines (default: true)
 *   maxChars    — limit scanning to first N chars (for performance on long texts).
 *                 When set and text exceeds this limit, a "Show more links" toggle
 *                 appears so the user can expand linkification on demand.
 *
 * Safety:
 *   - Never sets dangerouslySetInnerHTML
 *   - Code spans, URLs, file paths are excluded by scanText()
 *   - All exclusion logic lives in LinkableIndex.ts
 *
 * Usage:
 *   <LinkifyText text={turn.content} maxChars={2000} />
 */

import { useMemo, useState, type ReactNode } from 'react';
import { scanText } from '../lib/LinkableIndex';
import { EntityLink } from './EntityLink';
import { useApp } from '../contexts/AppContext';

interface Props {
  text: string;
  highlight?: boolean;
  maxChars?: number;
}

export function LinkifyText({ text, highlight = true, maxChars }: Props) {
  const { linkableIndex } = useApp();
  const [expanded, setExpanded] = useState(false);

  // When expanded, ignore maxChars; otherwise use caller-supplied limit.
  const effectiveMax = expanded ? undefined : maxChars;
  const showToggle = !expanded && maxChars != null && text.length > maxChars;

  const nodes = useMemo<ReactNode[]>(() => {
    if (!linkableIndex || !text) return [text];

    const matches = scanText(text, linkableIndex, effectiveMax);
    if (matches.length === 0) return [text];

    const parts: ReactNode[] = [];
    let cursor = 0;

    for (const m of matches) {
      // Text before the match
      if (m.start > cursor) {
        parts.push(text.slice(cursor, m.start));
      }
      // The linked term
      parts.push(
        <EntityLink
          key={`${m.start}-${m.end}`}
          targets={m.targets}
          text={m.text}
          highlight={highlight}
        />
      );
      cursor = m.end;
    }

    // Trailing text (or text beyond effectiveMax)
    if (cursor < text.length) {
      parts.push(text.slice(cursor));
    }

    return parts;
  }, [text, linkableIndex, highlight, effectiveMax]);

  return (
    <>
      {nodes}
      {showToggle && (
        <button
          type="button"
          data-testid="linkify-expand"
          onClick={() => setExpanded(true)}
          className="ml-1 text-xs opacity-50 hover:opacity-100 underline decoration-dotted cursor-pointer transition-opacity"
          title="Expand autolinking to the full text"
        >
          Show more links ↓
        </button>
      )}
    </>
  );
}
