import { useState, useEffect } from 'react';
import { FileText, Download, BarChart2, Table2, BookOpen } from 'lucide-react';

// ── Report manifest ────────────────────────────────────────────────────────────
interface ReportMeta {
  id: string;
  title: string;
  subtitle: string;
  filename: string;
  type: 'text' | 'csv';
  icon: React.ElementType;
  description: string;
}

const REPORTS: ReportMeta[] = [
  {
    id: 'pipeline_report',
    title: 'Scholarly Pipeline Report',
    subtitle: 'Full analysis of the esoteric studies chat archive',
    filename: 'scholarly_pipeline_report.txt',
    type: 'text',
    icon: BarChart2,
    description:
      'Exhaustive analysis of 249 ChatGPT conversations covering 9,864 turns and 3.16M words of AI text. ' +
      'Includes entity frequency, table template patterns, request type distributions, ' +
      'and a four-week roadmap for extending the pipeline.',
  },
  {
    id: 'mine_report',
    title: 'Mining Stats',
    subtitle: 'Quick summary from mine_chats.py',
    filename: 'mine_report.txt',
    type: 'text',
    icon: FileText,
    description:
      'Auto-generated summary produced by mine_chats.py each time the archive is re-indexed: ' +
      'conversation counts, top-mentioned entities, request type breakdown.',
  },
  {
    id: 'column_freq',
    title: 'Column Name Frequency',
    subtitle: 'All column headers extracted from 598 mined tables',
    filename: 'column_name_frequency.csv',
    type: 'csv',
    icon: Table2,
    description:
      'CSV of every column header found across 941 raw tables (598 passing quality filters) ' +
      'extracted from the chat archive. ' +
      'Shows which scholarly dimensions you return to most often.',
  },
  {
    id: 'table_study',
    title: 'Table Study — Raw Data',
    subtitle: '547 focused table-building requests, verbatim',
    filename: 'table_study_raw.txt',
    type: 'text',
    icon: BookOpen,
    description:
      'Every conversation turn where a table was explicitly requested, ' +
      'grouped by conversation. Used to derive the five EsoPipe table templates ' +
      'and the 13-type column vocabulary.',
  },
];

// ── CSV → simple HTML table renderer ─────────────────────────────────────────
function CsvTable({ raw }: { raw: string }) {
  const lines = raw.trim().split('\n');
  if (lines.length < 2) return <pre className="report-pre">{raw}</pre>;

  const parse = (line: string) =>
    line.split(',').map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'));

  const headers = parse(lines[0]);
  const rows    = lines.slice(1).map(parse);

  return (
    <div className="report-csv-wrap">
      <table className="report-csv-table">
        <thead>
          <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && (
        <p className="report-csv-note">Showing first 200 of {rows.length} rows.</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Reports() {
  const [selectedId, setSelectedId]   = useState<string>(REPORTS[0].id);
  const [content, setContent]         = useState<string>('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const selected = REPORTS.find(r => r.id === selectedId) ?? REPORTS[0];
  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    setLoading(true);
    setError(null);
    setContent('');
    fetch(`${base}data/reports/${selected.filename}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.text();
      })
      .then(text => { setContent(text); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [selected.filename, base]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = `${base}data/reports/${selected.filename}`;
    a.download = selected.filename;
    a.click();
  };

  return (
    <div className="reports-page">
      {/* Sidebar */}
      <nav className="reports-nav">
        <div className="reports-nav-header">Reports</div>
        {REPORTS.map(r => {
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              className={`reports-nav-item ${selectedId === r.id ? 'active' : ''}`}
              onClick={() => setSelectedId(r.id)}
            >
              <Icon size={14} className="reports-nav-icon" />
              <span>
                <span className="reports-nav-title">{r.title}</span>
                <span className="reports-nav-sub">{r.subtitle}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main className="reports-main">
        <div className="reports-header">
          <div>
            <h1 className="reports-title">{selected.title}</h1>
            <p className="reports-description">{selected.description}</p>
          </div>
          <button className="toolbar-btn reports-dl-btn" onClick={handleDownload}>
            <Download size={13} /> Download
          </button>
        </div>

        <div className="reports-body">
          {loading && <p className="reports-status">Loading…</p>}
          {error   && <p className="reports-status reports-error">Error: {error}</p>}
          {!loading && !error && content && (
            selected.type === 'csv'
              ? <CsvTable raw={content} />
              : <pre className="report-pre">{content}</pre>
          )}
        </div>
      </main>
    </div>
  );
}
