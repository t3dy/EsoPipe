import { Database, GitBranch, Clock, BookOpen } from 'lucide-react';
import { CodeBlock } from '../components/CodeBlock';

const ENTITY_EXAMPLE = `{
  "id": "thinker_ficino",
  "type": "thinker",
  "label": "Marsilio Ficino",
  "aliases": ["Ficino"],
  "blurb": "Florentine philosopher (1433–1499)...",
  "tags": ["neoplatonism", "renaissance"],
  "links": [
    { "label": "Wikipedia", "url": "https://..." }
  ]
}`;

const EDGE_EXAMPLE = `{
  "id": "e10",
  "source": "thinker_pico",
  "target": "thinker_ficino",
  "type": "derived-from",
  "weight": 3,
  "notes": "Pico was Ficino's student and collaborator"
}`;

const TIMELINE_EXAMPLE = `{
  "id": "timeline_neoplatonism_transmission",
  "title": "Transmission of Neoplatonism",
  "description": "From Plotinus to Ficino...",
  "tags": ["neoplatonism"],
  "events": [
    {
      "id": "time_001",
      "timeline_id": "timeline_neoplatonism_transmission",
      "start": "0204",
      "end": "0270",
      "title": "Plotinus (c. 204–270 CE)",
      "tags": ["neoplatonism"],
      "related_entities": ["thinker_plotinus"],
      "description_md": "Plotinus composes the **Enneads**...",
      "citations": []
    }
  ]
}`;

const LESSON_EXAMPLE = `{
  "id": "lesson_schema_design",
  "title": "Schema Design for Scholarly Archives",
  "summary": "Learn to model a collection of PDFs...",
  "difficulty": "intro",
  "estimated_time": "45 min",
  "tags": ["databases", "schema"],
  "cs_concepts": [
    { "name": "Normalization", "notes": "..." }
  ],
  "scholarly_application": {
    "domain": "Esoteric Studies",
    "notes": "..."
  },
  "sections": [
    { "heading": "Why Schemas?", "content_md": "..." }
  ],
  "code_snippets": [
    { "lang": "python", "title": "Create schema", "code": "..." }
  ],
  "exercises": [
    { "prompt": "Design a schema for...", "solution_md": "..." }
  ],
  "related_entities": ["tool_sqlite"]
}`;

const EDGE_TYPES = [
  { type: 'uses',         description: 'A lesson or workflow uses a tool or concept' },
  { type: 'explains',     description: 'A lesson or thinker explains a concept' },
  { type: 'compares',     description: 'A lesson compares two entities' },
  { type: 'derived-from', description: 'A thinker or text is intellectually derived from another' },
  { type: 'mentions',     description: 'A source mentions an entity without deep engagement' },
];

const ENTITY_TYPES = [
  { type: 'thinker',  description: 'Historical persons — philosophers, scholars, authors' },
  { type: 'text',     description: 'Primary sources — treatises, epistles, translations' },
  { type: 'concept',  description: 'Abstract ideas — emanation, neoplatonism, microcosm' },
  { type: 'tool',     description: 'Software or methods — SQLite, Python, MiniSearch' },
  { type: 'term',     description: 'Domain-specific vocabulary — theurgy, taʾwīl, henads' },
];

function SchemaCard({
  icon: Icon, title, children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded overflow-hidden"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--bg-surface)',
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}
      >
        <Icon size={16} style={{ color: 'var(--primary)' }} />
        <h2
          className="font-semibold text-sm"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Schema() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
        >
          Data Model
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          EsoPipe uses four JSON files in <code style={{ fontFamily: 'var(--font-mono)' }}>/public/data/</code>.
          All data is validated at startup using{' '}
          <a href="https://zod.dev" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Zod</a>.
          Add your own entities, edges, lessons, or timeline events by editing these files.
        </p>
      </div>

      <div className="space-y-6">
        {/* Entity */}
        <SchemaCard icon={Database} title="Entity — entities.json">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            The fundamental node type. Can be a historical person, a text, an abstract concept, a software tool, or a term.
            IDs use the pattern <code style={{ fontFamily: 'var(--font-mono)' }}>{'{type}_{snake_case}'}</code>.
          </p>

          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Entity Types
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {ENTITY_TYPES.map(({ type, description }) => (
                  <tr key={type} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-2 pr-4 w-28">
                      <span className="th-tag">{type}</span>
                    </td>
                    <td className="py-2" style={{ color: 'var(--text-muted)' }}>{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <CodeBlock lang="json" title="Example entity" code={ENTITY_EXAMPLE} />
        </SchemaCard>

        {/* Edge */}
        <SchemaCard icon={GitBranch} title="Edge — edges.json">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            A directed relationship between two entities (or between a lesson and an entity).
            The <code style={{ fontFamily: 'var(--font-mono)' }}>weight</code> field (1–3) controls
            edge thickness in the graph view.
          </p>

          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Edge Types
            </div>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {EDGE_TYPES.map(({ type, description }) => (
                  <tr key={type} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-2 pr-4 w-36">
                      <span className="th-tag">{type}</span>
                    </td>
                    <td className="py-2" style={{ color: 'var(--text-muted)' }}>{description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <CodeBlock lang="json" title="Example edge" code={EDGE_EXAMPLE} />
        </SchemaCard>

        {/* Timeline */}
        <SchemaCard icon={Clock} title="Timeline — timelines.json">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            A named chronology containing an array of events. Start/end dates are stored as strings
            (year only, e.g. <code style={{ fontFamily: 'var(--font-mono)' }}>"0950"</code>) to
            accommodate approximate BCE/CE dates. Each event links to related entities.
          </p>
          <CodeBlock lang="json" title="Example timeline + event" code={TIMELINE_EXAMPLE} />
        </SchemaCard>

        {/* Lesson */}
        <SchemaCard icon={BookOpen} title="Lesson — lessons.json">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            A full teaching unit with CS concepts, a scholarly application section, content sections
            (supporting inline Markdown), code snippets with copy buttons, and exercises with
            show/hide solutions.
          </p>
          <CodeBlock lang="json" title="Example lesson (abbreviated)" code={LESSON_EXAMPLE} />
        </SchemaCard>

        {/* ID convention */}
        <div
          className="p-4 text-sm"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--primary)',
            borderRadius: 'var(--radius)',
          }}
        >
          <strong style={{ color: 'var(--text-heading)' }}>ID Convention:</strong>
          <span style={{ color: 'var(--text-muted)' }}> All IDs follow </span>
          <code style={{ fontFamily: 'var(--font-mono)' }}>{'{type}_{descriptor}'}</code>
          <span style={{ color: 'var(--text-muted)' }}> — for example:</span>
          <ul className="mt-2 space-y-1" style={{ color: 'var(--text-muted)' }}>
            <li><code style={{ fontFamily: 'var(--font-mono)' }}>thinker_ficino</code> — Marsilio Ficino</li>
            <li><code style={{ fontFamily: 'var(--font-mono)' }}>concept_emanation</code> — Emanation doctrine</li>
            <li><code style={{ fontFamily: 'var(--font-mono)' }}>lesson_schema_design</code> — Schema Design lesson</li>
            <li><code style={{ fontFamily: 'var(--font-mono)' }}>timeline_neoplatonism_transmission</code> — Transmission timeline</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
