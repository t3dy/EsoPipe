import { useState, useRef, useEffect } from 'react';
import { Search, X, BookOpen, User, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import type { SearchResult } from '../types';

const iconFor = (type: SearchResult['type']) => {
  if (type === 'lesson') return <BookOpen size={13} />;
  if (type === 'entity') return <User size={13} />;
  return <Clock size={13} />;
};

const labelFor = (type: SearchResult['type']) => {
  if (type === 'lesson') return 'Lesson';
  if (type === 'entity') return 'Entity';
  return 'Event';
};

export function SearchBox() {
  const { search } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length >= 2) {
      setResults(search(query));
      setOpen(true);
    } else {
      setResults([]);
      setOpen(false);
    }
  }, [query, search]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const clear = () => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); };

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search lessons, entities, events…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-body)' }}
          aria-label="Global search"
        />
        {query && (
          <button onClick={clear} aria-label="Clear search"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
            <X size={13} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute top-full mt-1 w-full z-50 overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {results.map(r => (
            <Link
              key={r.id}
              to={r.href}
              onClick={() => { setOpen(false); setQuery(''); }}
              className="flex items-start gap-3 px-3 py-2 no-underline transition-colors"
              style={{ color: 'var(--text)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: 'var(--text-muted)', marginTop: '3px', flexShrink: 0 }}>
                {iconFor(r.type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}>
                    {r.label}
                  </span>
                  <span className="th-tag text-xs shrink-0">{labelFor(r.type)}</span>
                </div>
                {r.summary && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {r.summary.slice(0, 80)}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && results.length === 0 && (
        <div
          className="absolute top-full mt-1 w-full z-50 px-4 py-3 text-sm"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-muted)',
          }}
        >
          No results for "{query}"
        </div>
      )}
    </div>
  );
}
