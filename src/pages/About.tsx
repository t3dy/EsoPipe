import { Link } from 'react-router-dom';
import { Github, ArrowRight, Database, Brain, Network } from 'lucide-react';

export function About() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1
        className="text-3xl font-bold mb-3"
        style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
      >
        About EsoPipe
      </h1>

      <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
        A CS curriculum for scholarly researchers who want to build their own data pipelines —
        using esoteric studies as the domain and "vibe coding" as the methodology.
      </p>

      {/* What it is */}
      <section className="mb-8">
        <h2
          className="text-xl font-semibold mb-4"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}
        >
          What This Is
        </h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text)' }}>
          EsoPipe grew out of a specific workflow: using AI assistants to analyze a large archive
          of esoteric studies research — PDFs, chat transcripts, annotated texts — and wanting to
          turn those unstructured conversations into something queryable and navigable.
        </p>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text)' }}>
          The insight driving it is that scholarly research and software engineering are the same
          activity at different levels of abstraction. When you ask Claude to produce an
          analytical table about the Ikhwān al-Ṣafāʾ and then refine the prompt to add
          historiographical questions and richer cells — that <em>is</em> iterative schema design.
          EsoPipe makes that connection explicit.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
          The lessons are aimed at researchers who are comfortable with AI tools but want to go
          further: writing Python scripts, designing SQL schemas, and building knowledge graphs
          from their own archives.
        </p>
      </section>

      {/* The workflow */}
      <section className="mb-8">
        <h2
          className="text-xl font-semibold mb-4"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}
        >
          The Iterative Design Workflow
        </h2>
        <div className="space-y-3">
          {[
            {
              icon: Brain,
              step: '1. Mine your chats',
              desc: 'Export your AI conversations. These are a record of your scholarly desires and values — what questions you asked, what dimensions you requested, what you pushed back on.',
            },
            {
              icon: Database,
              step: '2. Design the schema',
              desc: 'Use the patterns in Lesson 1 to model your domain: what are the nouns (entities), what are the verbs (edges), how do you normalize the data?',
            },
            {
              icon: Brain,
              step: '3. Build prompt templates',
              desc: 'Use Lesson 2 to turn your ad-hoc AI requests into reusable Python templates that produce structured JSON — ready to insert into your database.',
            },
            {
              icon: Network,
              step: '4. Build the graph',
              desc: 'Use Lesson 3 to visualize and traverse the knowledge graph: find transmission paths, measure centrality, identify conceptual hubs.',
            },
          ].map(({ icon: Icon, step, desc }) => (
            <div
              key={step}
              className="flex gap-4 p-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
            >
              <div
                className="p-2 rounded shrink-0"
                style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius)' }}
              >
                <Icon size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text-heading)' }}>
                  {step}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How to extend */}
      <section className="mb-8">
        <h2
          className="text-xl font-semibold mb-4"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}
        >
          How to Extend the Dataset
        </h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text)' }}>
          All data lives in <code style={{ fontFamily: 'var(--font-mono)' }}>public/data/</code> as plain JSON files.
          Add new entities, edges, lessons, or timeline events by editing them directly —
          the app validates on load and will show any errors.
        </p>
        <div className="space-y-2 text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          <div><code>public/data/entities.json</code> — add thinkers, texts, concepts, tools, terms</div>
          <div><code>public/data/edges.json</code> — add relationships between any two entities</div>
          <div><code>public/data/lessons.json</code> — add full lessons with code and exercises</div>
          <div><code>public/data/timelines.json</code> — add new timelines or events to existing ones</div>
        </div>
        <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
          See the <Link to="/schema" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Schema page</Link> for
          the full data model and example JSON for each type.
        </p>
      </section>

      {/* Tech stack */}
      <section className="mb-8">
        <h2
          className="text-xl font-semibold mb-4"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}
        >
          Tech Stack
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Vite + React + TypeScript', 'Build tooling and component model'],
            ['Tailwind CSS', 'Utility-first styling + 4 CSS theme system'],
            ['React Router', 'Hash-based routing for static deployment'],
            ['TanStack Table', 'Sortable, filterable entity tables'],
            ['React Flow (@xyflow)', 'Interactive knowledge graph canvas'],
            ['MiniSearch', 'Client-side full-text search index'],
            ['Prism.js', 'Syntax highlighting for Python, SQL, JSON'],
            ['Zod', 'Runtime JSON schema validation'],
          ].map(([lib, desc]) => (
            <div
              key={lib}
              className="p-3"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            >
              <div className="font-medium mb-0.5" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                {lib}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Links */}
      <div className="flex flex-wrap gap-3">
        <a
          href="https://github.com/t3dy/EsoPipe"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-text)',
            borderRadius: 'var(--radius)',
            textDecoration: 'none',
          }}
        >
          <Github size={15} /> View on GitHub
        </a>
        <Link
          to="/lessons"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium"
          style={{
            background: 'var(--bg-surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            textDecoration: 'none',
          }}
        >
          Start with Lesson 1 <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
