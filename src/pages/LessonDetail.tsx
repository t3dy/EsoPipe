import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronDown, ChevronUp, Clock, User,
  Lightbulb, BookOpen, Code2, GraduationCap,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { CodeBlock } from '../components/CodeBlock';
import type { Difficulty } from '../types';

const DIFF_COLORS: Record<Difficulty, string> = {
  intro: 'var(--badge-intro)',
  intermediate: 'var(--badge-intermediate)',
  advanced: 'var(--badge-advanced)',
};

function SimpleMarkdown({ md }: { md: string }) {
  // Very minimal markdown: bold, inline code, line breaks → paragraphs
  const html = md
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .split(/\n\n+/)
    .map(para => {
      if (para.startsWith('```')) {
        // code block — handled separately
        return para;
      }
      return `<p>${para.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  return (
    <div
      className="prose"
      style={{ maxWidth: 'none' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ExerciseCard({ prompt, solution_md }: { prompt: string; solution_md: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}
    >
      <div className="p-4">
        <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--text)' }}>
          {prompt}
        </p>
        {solution_md && (
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1 mt-3 text-xs font-medium transition-opacity hover:opacity-70"
            style={{
              color: 'var(--primary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {open ? 'Hide solution' : 'Show solution'}
          </button>
        )}
      </div>

      {open && solution_md && (
        <div
          className="border-t p-4"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--bg-surface)',
          }}
        >
          <SolutionRenderer md={solution_md} />
        </div>
      )}
    </div>
  );
}

function SolutionRenderer({ md }: { md: string }) {
  // Split on ``` code blocks
  const parts = md.split(/(```[\w]*\n[\s\S]*?```)/g);
  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        const codeMatch = part.match(/^```(\w*)\n([\s\S]*?)```$/);
        if (codeMatch) {
          return <CodeBlock key={i} lang={codeMatch[1] || 'text'} code={codeMatch[2]} />;
        }
        if (part.trim()) return <SimpleMarkdown key={i} md={part} />;
        return null;
      })}
    </div>
  );
}

export function LessonDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, openEntityDrawer } = useApp();

  if (loading) return <div className="p-8" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  const lesson = data?.lessons.find(l => l.id === id);
  if (!lesson) return <Navigate to="/lessons" replace />;

  const relatedEntities = (data?.entities ?? []).filter(e =>
    lesson.related_entities.includes(e.id)
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Back */}
      <Link
        to="/lessons"
        className="flex items-center gap-1 text-sm mb-6 hover:underline"
        style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
      >
        <ChevronLeft size={14} /> All Lessons
      </Link>

      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className="text-xs px-2 py-0.5 font-medium rounded"
            style={{ background: DIFF_COLORS[lesson.difficulty], color: '#fff', borderRadius: 'var(--radius)' }}
          >
            {lesson.difficulty}
          </span>
          {lesson.estimated_time && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Clock size={11} /> {lesson.estimated_time}
            </span>
          )}
          {lesson.tags.map(t => <span key={t} className="th-tag">{t}</span>)}
        </div>

        <h1
          className="text-3xl font-bold mb-3 leading-tight"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
        >
          {lesson.title}
        </h1>

        <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {lesson.summary}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-8">
        {/* Main column */}
        <div className="col-span-2 space-y-8">
          {/* CS Concepts */}
          {lesson.cs_concepts.length > 0 && (
            <section>
              <h2
                className="flex items-center gap-2 text-lg font-semibold mb-4"
                style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
              >
                <Lightbulb size={18} style={{ color: 'var(--primary)' }} />
                CS Concepts
              </h2>
              <div className="space-y-3">
                {lesson.cs_concepts.map(c => (
                  <div
                    key={c.name}
                    className="p-4"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-heading)' }}>
                      {c.name}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {c.notes}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Scholarly Application */}
          {lesson.scholarly_application && (
            <section>
              <h2
                className="flex items-center gap-2 text-lg font-semibold mb-4"
                style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
              >
                <BookOpen size={18} style={{ color: 'var(--primary)' }} />
                Scholarly Application
              </h2>
              <div
                className="p-4"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid var(--primary)`,
                  borderRadius: 'var(--radius)',
                }}
              >
                <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                  {lesson.scholarly_application.domain}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                  {lesson.scholarly_application.notes}
                </p>
              </div>
            </section>
          )}

          {/* Sections */}
          {lesson.sections.map((sec, i) => (
            <section key={i}>
              <h2
                className="text-xl font-semibold mb-4 pb-2"
                style={{
                  color: 'var(--text-heading)',
                  fontFamily: 'var(--font-heading)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {sec.heading}
              </h2>
              <SectionContent content={sec.content_md} />
            </section>
          ))}

          {/* Code Snippets */}
          {lesson.code_snippets.length > 0 && (
            <section>
              <h2
                className="flex items-center gap-2 text-lg font-semibold mb-4"
                style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
              >
                <Code2 size={18} style={{ color: 'var(--primary)' }} />
                Code Snippets
              </h2>
              {lesson.code_snippets.map((s, i) => (
                <CodeBlock key={i} lang={s.lang} title={s.title} code={s.code} />
              ))}
            </section>
          )}

          {/* Exercises */}
          {lesson.exercises.length > 0 && (
            <section>
              <h2
                className="flex items-center gap-2 text-lg font-semibold mb-4"
                style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
              >
                <GraduationCap size={18} style={{ color: 'var(--primary)' }} />
                Exercises
              </h2>
              <div className="space-y-4">
                {lesson.exercises.map((ex, i) => (
                  <div key={i}>
                    <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Exercise {i + 1}
                    </div>
                    <ExerciseCard prompt={ex.prompt} solution_md={ex.solution_md} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="col-span-1 space-y-5">
          {/* Related entities */}
          {relatedEntities.length > 0 && (
            <div
              className="p-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
            >
              <h3
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-muted)' }}
              >
                <User size={12} /> Related Entities
              </h3>
              <div className="space-y-2">
                {relatedEntities.map(e => (
                  <button
                    key={e.id}
                    onClick={() => openEntityDrawer(e)}
                    className="w-full text-left p-2 rounded transition-colors text-sm"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius)',
                    }}
                    onMouseEnter={el => (el.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={el => (el.currentTarget.style.background = 'none')}
                  >
                    <div className="font-medium" style={{ color: 'var(--text-heading)' }}>
                      {e.label}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {e.type}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionContent({ content }: { content: string }) {
  // Split out fenced code blocks from prose
  const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
  return (
    <div className="space-y-4">
      {parts.map((part, i) => {
        const codeMatch = part.match(/^```(\w*)\n([\s\S]*?)```$/);
        if (codeMatch) {
          return <CodeBlock key={i} lang={codeMatch[1] || 'text'} code={codeMatch[2].trimEnd()} />;
        }
        if (part.trim()) return <SimpleMarkdown key={i} md={part} />;
        return null;
      })}
    </div>
  );
}
