/**
 * SemanticBreadcrumbs — clickable tag-chain breadcrumb at top of detail pages.
 *
 * Displays:  Home › [tag1] › [tag2] › EntityName
 * Each tag links to /search?tag=X so the user can pivot to related items.
 *
 * Usage:
 *   <SemanticBreadcrumbs tags={entity.tags} label={entity.label} />
 */

import { useNavigate } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';

interface Props {
  tags?: string[];
  label: string;
  /** At most this many tags shown (default 2) */
  maxTags?: number;
}

export function SemanticBreadcrumbs({ tags = [], label, maxTags = 2 }: Props) {
  const navigate = useNavigate();
  const visibleTags = tags.slice(0, maxTags);

  return (
    <nav
      className="flex items-center gap-1 text-[11px] flex-wrap"
      style={{ color: 'var(--text-muted)' }}
      aria-label="Breadcrumb"
    >
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 hover:text-[var(--primary)] transition-colors"
      >
        <Home size={10} />
        Home
      </button>

      {visibleTags.map(tag => (
        <span key={tag} className="flex items-center gap-1">
          <ChevronRight size={10} className="opacity-40" />
          <button
            onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
            className="hover:text-[var(--primary)] transition-colors capitalize"
          >
            {tag}
          </button>
        </span>
      ))}

      <ChevronRight size={10} className="opacity-40" />
      <span style={{ color: 'var(--text-heading)', fontWeight: 600 }} className="truncate max-w-[200px]">
        {label}
      </span>
    </nav>
  );
}
