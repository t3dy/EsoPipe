import { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { Download, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import type { ScholarlyTable, ColType } from '../types';

// ── Template labels ──────────────────────────────────────────────────────────
const TEMPLATE_LABELS: Record<string, string> = {
  'philosophical-comparison': 'Tradition Comparison',
  'scholar-profile':          'Scholar Profile',
  'inventory':                'Comparative Inventory',
  'evidence-audit':           'Argument Audit',
  'article-decomposition':    'Article Decomposition',
};

// ── Column type → css class segments ────────────────────────────────────────
const COL_HEADER_CLASS: Record<ColType, string> = {
  concept:       'col-concept',
  tradition:     'col-tradition',
  contributions: 'col-contributions',
  challenges:    'col-challenges',
  quotation:     'col-quotation',
  takeaway:      'col-takeaway',
  lacunae:       'col-lacunae',
  figure:        'col-figure',
  works:         'col-works',
  methodology:   'col-methodology',
  content:       'col-content',
  context:       'col-context',
  notes:         'col-notes',
};

const COL_CELL_CLASS: Record<ColType, string> = {
  concept:       'cell-concept',
  tradition:     'cell-tradition',
  contributions: 'cell-contributions',
  challenges:    'cell-challenges',
  quotation:     'cell-quotation',
  takeaway:      'cell-takeaway',
  lacunae:       'cell-lacunae',
  figure:        'cell-figure',
  works:         'cell-works',
  methodology:   'cell-methodology',
  content:       'cell-content',
  context:       'cell-context',
  notes:         'cell-notes',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function exportCSV(table: ScholarlyTable) {
  const headers = table.columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const rows = table.rows.map(row =>
    table.columns.map(c => `"${(row[c.id] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${table.id}.csv`;
  a.click();
}

function ColBadge({ type }: { type: ColType }) {
  const SHORT: Record<ColType, string> = {
    concept: 'concept', tradition: 'tradition', contributions: 'contrib',
    challenges: 'challenge', quotation: 'quote', takeaway: 'takeaway',
    lacunae: 'lacuna', figure: 'figure', works: 'works',
    methodology: 'method', content: 'content', context: 'context', notes: 'notes',
  };
  return <span className={`col-type-badge col-type-${type}`}>{SHORT[type]}</span>;
}

// ── Table renderer ───────────────────────────────────────────────────────────
function ScholarTable({ table, compact }: { table: ScholarlyTable; compact: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(
      `${window.location.origin}${window.location.pathname}#/tables?t=${table.id}`
    ).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [table.id]);

  return (
    <div className="scholar-table-wrap">
      {/* toolbar — above the table, not a title on the table itself */}
      <div className="table-toolbar">
        <div className="table-meta">
          <span className="table-template-label">{TEMPLATE_LABELS[table.template] ?? table.template}</span>
          <p className="table-description">{table.description}</p>
        </div>
        <div className="table-actions">
          <button className="toolbar-btn" onClick={handleCopy}>
            {copied ? <Check size={13}/> : <Copy size={13}/>}
            {copied ? 'Copied' : 'Link'}
          </button>
          <button className="toolbar-btn" onClick={() => exportCSV(table)}>
            <Download size={13}/> CSV
          </button>
        </div>
      </div>

      {/* column-type key */}
      <div className="col-key">
        {table.columns.map(col => (
          <span key={col.id} className="col-key-item">
            <ColBadge type={col.type} />
            <span className="col-key-label">{col.label}</span>
          </span>
        ))}
      </div>

      {/* The table — no outer title, no index column */}
      <div className="table-scroll-guard">
        <table className={`scholarly-table ${compact ? 'compact' : 'detailed'}`}>
          <thead>
            <tr>
              {table.columns.map(col => (
                <th
                  key={col.id}
                  className={COL_HEADER_CLASS[col.type]}
                  style={col.width !== 'auto' ? { width: `${col.width}%` } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'row-even' : 'row-odd'}>
                {table.columns.map(col => (
                  <td key={col.id} className={COL_CELL_CLASS[col.type]}>
                    {row[col.id] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sidebar list ─────────────────────────────────────────────────────────────
function TableList({
  tables, selectedId, onSelect,
}: {
  tables: ScholarlyTable[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const groups: Record<string, ScholarlyTable[]> = {};
  tables.forEach(t => {
    const g = TEMPLATE_LABELS[t.template] ?? t.template;
    (groups[g] ??= []).push(t);
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (g: string) => setCollapsed(c => ({ ...c, [g]: !c[g] }));

  return (
    <nav className="table-list-nav">
      <div className="table-list-header">Tables</div>

      {Object.entries(groups).map(([grp, items]) => (
        <div key={grp} className="table-group">
          <button className="table-group-btn" onClick={() => toggle(grp)}>
            {collapsed[grp] ? <ChevronRight size={11}/> : <ChevronDown size={11}/>}
            {grp}
          </button>
          {!collapsed[grp] && items.map(t => (
            <button
              key={t.id}
              className={`table-nav-item ${selectedId === t.id ? 'active' : ''}`}
              onClick={() => onSelect(t.id)}
            >
              <span className="table-nav-title">{t.title}</span>
              <span className="table-nav-tags">
                {t.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="th-tag">{tag}</span>
                ))}
              </span>
            </button>
          ))}
        </div>
      ))}

      {/* column type legend */}
      <div className="col-legend">
        <div className="col-legend-title">Column types</div>
        {(Object.keys(COL_HEADER_CLASS) as ColType[]).map(type => (
          <div key={type} className="col-legend-row">
            <ColBadge type={type}/>
          </div>
        ))}
      </div>
    </nav>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Tables() {
  const { data, loading } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);

  if (loading) return <div className="page-loading">Loading tables…</div>;

  const tables = data?.tables ?? [];
  const selected = (selectedId ? tables.find(t => t.id === selectedId) : null) ?? tables[0];

  if (!tables.length) {
    return (
      <div style={{ padding: '2rem', opacity: 0.7 }}>
        No tables found. Add entries to <code>public/data/tables.json</code>.
      </div>
    );
  }

  return (
    <div className="tables-page">
      <TableList
        tables={tables}
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
      />

      <main className="tables-main">
        {selected ? (
          <>
            <div className="tables-page-header">
              <h1 className="tables-page-title">{selected.title}</h1>
              <label className="compact-toggle">
                <input
                  type="checkbox"
                  checked={compact}
                  onChange={e => setCompact(e.target.checked)}
                />
                Compact
              </label>
            </div>
            <ScholarTable table={selected} compact={compact} />
          </>
        ) : (
          <p style={{ padding: '2rem', opacity: 0.5 }}>Select a table from the sidebar.</p>
        )}
      </main>
    </div>
  );
}
