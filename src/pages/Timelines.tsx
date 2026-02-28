import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Calendar, Tag } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { TimelineEvent, Timeline } from '../types';

// ─── Simple Markdown renderer for event descriptions ──────────────────────
function EventMarkdown({ md }: { md: string }) {
  const parts = md.split(/\n\n+/);
  return (
    <div className="prose" style={{ maxWidth: 'none', fontSize: '0.875rem' }}>
      {parts.map((para, i) => {
        const html = para
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>')
          .replace(/\n/g, '<br/>');
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

// ─── Single timeline event row ────────────────────────────────────────────
function EventRow({
  event,
  isSelected,
  onClick,
}: {
  event: TimelineEvent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const displayYear = event.start.length >= 4 ? `c. ${event.start.slice(0, 4)}` : event.start;

  return (
    <div
      className="flex gap-4 cursor-pointer group"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div
          className="w-3 h-3 rounded-full shrink-0 mt-1 transition-transform group-hover:scale-125"
          style={{
            background: isSelected ? 'var(--primary)' : 'var(--border-strong)',
            border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border-strong)'}`,
          }}
        />
        <div
          className="w-px flex-1 mt-1"
          style={{ background: 'var(--border)', minHeight: '32px' }}
        />
      </div>

      {/* Content */}
      <div
        className="flex-1 pb-6 rounded transition-colors"
        style={{ marginBottom: '0' }}
      >
        <div
          className="text-xs font-medium mb-1"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {displayYear}
          {event.end && ` — ${event.end.slice(0, 4)}`}
        </div>
        <div
          className="font-semibold text-sm mb-1 transition-colors"
          style={{
            color: isSelected ? 'var(--primary)' : 'var(--text-heading)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          {event.title}
        </div>
        {event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.tags.slice(0, 4).map(t => (
              <span key={t} className="th-tag">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Event detail panel ───────────────────────────────────────────────────
function EventPanel({
  event,
  onClose,
}: {
  event: TimelineEvent;
  timeline?: Timeline;
  onClose: () => void;
}) {
  const { data, openEntityDrawer } = useApp();
  const entityMap = Object.fromEntries((data?.entities ?? []).map(e => [e.id, e]));
  const displayYear = event.start.length >= 4 ? `c. ${event.start.slice(0, 4)}` : event.start;

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 p-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {displayYear}
            </span>
          </div>
          <h3
            className="font-semibold text-base leading-snug"
            style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
          >
            {event.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {event.description_md && (
          <EventMarkdown md={event.description_md} />
        )}

        {/* Tags */}
        {event.tags.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-muted)' }}>
              <Tag size={10} /> Tags
            </div>
            <div className="flex flex-wrap gap-1">
              {event.tags.map(t => <span key={t} className="th-tag">{t}</span>)}
            </div>
          </div>
        )}

        {/* Related entities */}
        {event.related_entities.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-muted)' }}>
              Related Entities
            </div>
            <div className="space-y-1">
              {event.related_entities.map(eid => {
                const entity = entityMap[eid];
                if (!entity) return <span key={eid} className="text-xs th-muted">{eid}</span>;
                return (
                  <button
                    key={eid}
                    onClick={() => openEntityDrawer(entity)}
                    className="w-full text-left px-3 py-2 rounded text-sm transition-colors"
                    style={{
                      background: 'var(--bg-hover)',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius)',
                      color: 'var(--text)',
                    }}
                  >
                    <span className="font-medium" style={{ color: 'var(--text-heading)' }}>{entity.label}</span>
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{entity.type}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export function Timelines() {
  const { data, loading } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const timelineId = searchParams.get('timeline');
  const eventId = searchParams.get('event');

  if (loading) return <div className="p-8" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  const timelines = data?.timelines ?? [];
  const activeTimeline = timelines.find(t => t.id === timelineId) ?? timelines[0];
  const selectedEvent = activeTimeline?.events.find(e => e.id === eventId) ?? null;

  const filteredEvents = activeTimeline?.events.filter(e =>
    !activeTag || e.tags.includes(activeTag)
  ) ?? [];

  const allTags = [...new Set(activeTimeline?.events.flatMap(e => e.tags) ?? [])];

  const selectEvent = (event: TimelineEvent) => {
    setSearchParams({
      timeline: activeTimeline?.id ?? '',
      event: event.id,
    });
  };

  const selectTimeline = (tl: Timeline) => {
    setSearchParams({ timeline: tl.id });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
        >
          Timelines
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Chronological views of intellectual history, linked to entities and events.
        </p>
      </div>

      {/* Timeline selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {timelines.map(tl => (
          <button
            key={tl.id}
            onClick={() => selectTimeline(tl)}
            className="px-4 py-2 text-sm transition-colors"
            style={{
              background: activeTimeline?.id === tl.id ? 'var(--primary)' : 'var(--bg-surface)',
              color: activeTimeline?.id === tl.id ? 'var(--primary-text)' : 'var(--text)',
              border: '1px solid',
              borderColor: activeTimeline?.id === tl.id ? 'var(--primary)' : 'var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {tl.title}
          </button>
        ))}
      </div>

      {activeTimeline && (
        <>
          {/* Timeline description */}
          <div className="mb-6">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {activeTimeline.description}
            </p>
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className="th-tag cursor-pointer transition-colors"
                  style={{
                    background: activeTag === tag ? 'var(--primary)' : 'var(--tag-bg)',
                    color: activeTag === tag ? 'var(--primary-text)' : 'var(--tag-text)',
                    borderColor: activeTag === tag ? 'var(--primary)' : 'var(--tag-border)',
                  }}
                >
                  {tag}
                </button>
              ))}
              {activeTag && (
                <button
                  onClick={() => setActiveTag(null)}
                  className="text-xs px-2 py-0.5"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  × Clear
                </button>
              )}
            </div>
          )}

          {/* Two-column layout: timeline + detail */}
          <div className="grid grid-cols-5 gap-6">
            {/* Timeline spine */}
            <div className="col-span-2">
              {filteredEvents.map(event => (
                <EventRow
                  key={event.id}
                  event={event}
                  isSelected={selectedEvent?.id === event.id}
                  onClick={() => selectEvent(event)}
                />
              ))}
            </div>

            {/* Event detail */}
            <div className="col-span-3">
              {selectedEvent ? (
                <EventPanel
                  event={selectedEvent}
                  timeline={activeTimeline}
                  onClose={() => setSearchParams({ timeline: activeTimeline.id })}
                />
              ) : (
                <div
                  className="flex items-center justify-center h-48 text-sm"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text-muted)',
                  }}
                >
                  Click an event to see details
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
