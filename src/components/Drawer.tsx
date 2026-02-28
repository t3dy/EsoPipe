import { X, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

const TYPE_COLORS: Record<string, string> = {
  thinker:  '#a86830',
  text:     '#1e40af',
  concept:  '#7c3aed',
  tool:     '#15803d',
  term:     '#991b1b',
};

function copyLink(id: string) {
  const url = `${window.location.origin}${window.location.pathname}#/graph?node=${id}`;
  navigator.clipboard.writeText(url);
}

export function Drawer() {
  const { drawerOpen, setDrawerOpen, selectedEntity, data, setSelectedEntity } = useApp();

  if (!drawerOpen || !selectedEntity) return null;

  const entity = selectedEntity;
  const edges = data?.edges ?? [];
  const entities = data?.entities ?? [];

  const entityMap = Object.fromEntries(entities.map(e => [e.id, e]));
  const outgoing = edges.filter(e => e.source === entity.id);
  const incoming = edges.filter(e => e.target === entity.id);

  const color = TYPE_COLORS[entity.type] ?? 'var(--primary)';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.25)' }}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
        style={{
          width: 'min(420px, 90vw)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between p-4 gap-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-xs px-2 py-0.5 font-medium uppercase tracking-wider"
                style={{ background: color, color: '#fff', borderRadius: 'var(--radius)' }}
              >
                {entity.type}
              </span>
              {entity.tags.slice(0, 3).map(t => (
                <span key={t} className="th-tag">{t}</span>
              ))}
            </div>
            <h2
              className="text-lg font-semibold leading-snug"
              style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
            >
              {entity.label}
            </h2>
            {entity.aliases.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Also: {entity.aliases.join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => copyLink(entity.id)}
              className="p-1.5 rounded transition-opacity hover:opacity-70"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              title="Copy link to this entity"
            >
              <LinkIcon size={15} />
            </button>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded transition-opacity hover:opacity-70"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Blurb */}
          {entity.blurb && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              {entity.blurb}
            </p>
          )}

          {/* Outgoing edges */}
          {outgoing.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-muted)' }}>
                Outgoing Relations
              </h3>
              <ul className="space-y-1.5">
                {outgoing.map(edge => {
                  const target = entityMap[edge.target];
                  return (
                    <li key={edge.id} className="flex items-start gap-2 text-sm">
                      <span
                        className="text-xs px-1.5 py-0.5 shrink-0 mt-0.5"
                        style={{
                          background: 'var(--bg-hover)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {edge.type}
                      </span>
                      {target ? (
                        <button
                          className="text-left hover:underline"
                          style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: 'inherit' }}
                          onClick={() => setSelectedEntity(target)}
                        >
                          {target.label}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{edge.target}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Incoming edges */}
          {incoming.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-muted)' }}>
                Referenced By
              </h3>
              <ul className="space-y-1.5">
                {incoming.map(edge => {
                  const src = entityMap[edge.source];
                  return (
                    <li key={edge.id} className="flex items-start gap-2 text-sm">
                      <span
                        className="text-xs px-1.5 py-0.5 shrink-0 mt-0.5"
                        style={{
                          background: 'var(--bg-hover)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        ← {edge.type}
                      </span>
                      {src ? (
                        <button
                          className="text-left hover:underline"
                          style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)', fontSize: 'inherit' }}
                          onClick={() => setSelectedEntity(src)}
                        >
                          {src.label}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{edge.source}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* External links */}
          {entity.links.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: 'var(--text-muted)' }}>
                Links
              </h3>
              <ul className="space-y-1">
                {entity.links.map((lk, i) => (
                  <li key={i}>
                    <a
                      href={lk.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm flex items-center gap-1 hover:underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      <ExternalLink size={11} />
                      {lk.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* View in graph */}
          <Link
            to={`/graph?node=${entity.id}`}
            onClick={() => setDrawerOpen(false)}
            className="block text-center py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-text)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
            }}
          >
            View in Knowledge Graph
          </Link>
        </div>
      </div>
    </>
  );
}
