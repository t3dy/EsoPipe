import { Link } from 'react-router-dom';
import { BookOpen, Table2, CalendarDays, Network, ArrowRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

const FEATURES = [
  {
    to: '/lessons',
    icon: BookOpen,
    title: 'Lessons',
    desc: 'Hands-on CS tutorials using esoteric scholarship as the worked domain — schema design, LLM prompts, knowledge graphs.',
    color: '#a86830',
  },
  {
    to: '/tables',
    icon: Table2,
    title: 'Relational Tables',
    desc: 'Browse the entity archive: thinkers, texts, concepts, and tools — sortable, filterable, and exportable to CSV.',
    color: '#1e40af',
  },
  {
    to: '/timelines',
    icon: CalendarDays,
    title: 'Timelines',
    desc: 'Five tradition timelines — Neoplatonism, Alchemy, Kabbalah, Islamic Esotericism, and Renaissance Magic — with 60 annotated events linked to the entity graph.',
    color: '#7c3aed',
  },
  {
    to: '/graph',
    icon: Network,
    title: 'Knowledge Graph',
    desc: 'Explore the relational network connecting lessons, thinkers, texts, and concepts through typed edges.',
    color: '#15803d',
  },
];

export function Home() {
  const { data, loading } = useApp();

  const counts = {
    lessons: data?.lessons.length ?? 0,
    entities: data?.entities.length ?? 0,
    edges: data?.edges.length ?? 0,
    timelineEvents: data?.timelines.reduce((sum, t) => sum + t.events.length, 0) ?? 0,
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Hero */}
      <header className="mb-12">
        <div
          className="text-xs font-medium uppercase tracking-widest mb-3"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          EsoPipe · CS for Magical Scholarship
        </div>
        <h1
          className="text-4xl font-bold mb-4 leading-tight"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
        >
          Build a Data Pipeline for<br />Esoteric Studies Research
        </h1>
        <p className="text-lg leading-relaxed max-w-2xl" style={{ color: 'var(--text)' }}>
          A hands-on curriculum for scholars who want to use CS and LLM techniques
          to mine, structure, and navigate their research archives.
          Learn schema design, prompt engineering, and knowledge graph traversal
          — with Neoplatonism as the worked example.
        </p>

        <div className="flex flex-wrap gap-3 mt-6">
          <Link
            to="/lessons"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-85"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-text)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
            }}
          >
            Start Learning <ArrowRight size={15} />
          </Link>
          <Link
            to="/graph"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium"
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
            }}
          >
            Explore the Graph
          </Link>
        </div>
      </header>

      {/* Stats row */}
      {!loading && (
        <div
          className="grid grid-cols-4 gap-4 mb-12 p-5"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          {[
            { label: 'Lessons', value: counts.lessons },
            { label: 'Entities', value: counts.entities },
            { label: 'Edges', value: counts.edges },
            { label: 'Timeline Events', value: counts.timelineEvents },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div
                className="text-3xl font-bold"
                style={{ color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}
              >
                {value}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feature cards */}
      <div className="grid grid-cols-2 gap-5 mb-12">
        {FEATURES.map(({ to, icon: Icon, title, desc, color }) => (
          <Link
            key={to}
            to={to}
            className="th-card block group"
            style={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            <div className="flex items-start gap-3">
              <div
                className="p-2 rounded shrink-0"
                style={{ background: color + '18', borderRadius: 'var(--radius)' }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <h3
                  className="font-semibold mb-1 text-base"
                  style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {desc}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Philosophy section */}
      <section
        className="p-6"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
        >
          The Approach: Iterative Scholarly Vibe Coding
        </h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text)' }}>
          EsoPipe is built around the idea that scholarly research and software engineering
          are the same activity at different levels of abstraction.
          When you ask an AI to produce an analytical table about the Ikhwān al-Ṣafāʾ,
          you are doing <em>schema design</em>. When you refine the prompt to add historiographical
          questions, you are doing <em>iterative data modeling</em>.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
          The lessons in this curriculum make that connection explicit, giving you reusable
          Python scripts, SQL schemas, and prompt templates that turn your chat archive
          into a living, queryable research database.
        </p>
        <Link
          to="/about"
          className="inline-flex items-center gap-1 text-sm mt-3 hover:underline"
          style={{ color: 'var(--primary)', textDecoration: 'none' }}
        >
          Read more about the project <ArrowRight size={13} />
        </Link>
      </section>
    </div>
  );
}
