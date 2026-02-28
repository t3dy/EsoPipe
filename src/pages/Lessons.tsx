import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ChevronRight, BookOpen } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Difficulty } from '../types';

const ALL_TAGS = ['databases', 'schema', 'python', 'sqlite', 'dh', 'llm', 'prompt-design', 'nlp', 'graphs', 'intellectual-history', 'networkx'];

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  intro: 'Intro',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function DifficultyBadge({ d }: { d: Difficulty }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded font-medium"
      style={{
        color: '#fff',
        background: `var(--badge-${d})`,
        borderRadius: 'var(--radius)',
      }}
    >
      {DIFFICULTY_LABELS[d]}
    </span>
  );
}

export function Lessons() {
  const { data, loading } = useApp();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeDiff, setActiveDiff] = useState<Difficulty | null>(null);

  if (loading) return <LoadingState />;

  const lessons = data?.lessons ?? [];
  const filtered = lessons.filter(l => {
    if (activeTag && !l.tags.includes(activeTag)) return false;
    if (activeDiff && l.difficulty !== activeDiff) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
          >
            Lessons
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            CS techniques applied to esoteric studies research — from schema design to knowledge graphs.
          </p>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} / {lessons.length} lessons
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Difficulty filters */}
        {(['intro', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
          <button
            key={d}
            onClick={() => setActiveDiff(activeDiff === d ? null : d)}
            className="text-xs px-3 py-1 transition-colors"
            style={{
              background: activeDiff === d ? `var(--badge-${d})` : 'var(--bg-surface)',
              color: activeDiff === d ? '#fff' : 'var(--text)',
              border: `1px solid ${activeDiff === d ? 'transparent' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {DIFFICULTY_LABELS[d]}
          </button>
        ))}

        <div style={{ width: '1px', background: 'var(--border)', margin: '0 4px' }} />

        {/* Tag filters */}
        {ALL_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className="th-tag transition-colors cursor-pointer"
            style={{
              background: activeTag === tag ? 'var(--primary)' : 'var(--tag-bg)',
              color: activeTag === tag ? 'var(--primary-text)' : 'var(--tag-text)',
              borderColor: activeTag === tag ? 'var(--primary)' : 'var(--tag-border)',
              cursor: 'pointer',
            }}
          >
            {tag}
          </button>
        ))}

        {(activeTag || activeDiff) && (
          <button
            onClick={() => { setActiveTag(null); setActiveDiff(null); }}
            className="text-xs px-2 py-0.5"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            × Clear
          </button>
        )}
      </div>

      {/* Lesson cards */}
      <div className="space-y-4">
        {filtered.map(lesson => (
          <Link
            key={lesson.id}
            to={`/lessons/${lesson.id}`}
            className="th-card flex items-start gap-5 group"
            style={{ textDecoration: 'none', display: 'flex' }}
          >
            <div
              className="p-3 rounded shrink-0"
              style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius)' }}
            >
              <BookOpen size={20} style={{ color: 'var(--primary)' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <DifficultyBadge d={lesson.difficulty} />
                {lesson.estimated_time && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={11} /> {lesson.estimated_time}
                  </span>
                )}
              </div>

              <h2
                className="text-lg font-semibold mb-1 leading-snug"
                style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
              >
                {lesson.title}
              </h2>

              <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
                {lesson.summary}
              </p>

              {/* CS concepts preview */}
              {lesson.cs_concepts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {lesson.cs_concepts.map(c => (
                    <span key={c.name} className="th-tag">{c.name}</span>
                  ))}
                </div>
              )}
            </div>

            <ChevronRight
              size={18}
              className="shrink-0 mt-1 transition-transform group-hover:translate-x-1"
              style={{ color: 'var(--text-muted)' }}
            />
          </Link>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            No lessons match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 rounded" style={{ background: 'var(--bg-surface)' }} />
        ))}
      </div>
    </div>
  );
}
