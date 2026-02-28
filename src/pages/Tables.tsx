import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Search } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { Entity, EntityType } from '../types';

const TYPE_LABELS: Record<EntityType, string> = {
  thinker: 'Thinkers',
  text: 'Texts',
  concept: 'Concepts',
  tool: 'Tools',
  term: 'Terms',
};

const TYPE_ORDER: EntityType[] = ['thinker', 'text', 'concept', 'tool', 'term'];

const helper = createColumnHelper<Entity>();

const COLUMNS = [
  helper.accessor('label', {
    header: 'Name',
    cell: info => (
      <span style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
        {info.getValue()}
      </span>
    ),
  }),
  helper.accessor('type', {
    header: 'Type',
    cell: info => (
      <span className="th-tag">{info.getValue()}</span>
    ),
  }),
  helper.accessor('blurb', {
    header: 'Description',
    cell: info => (
      <span className="text-sm line-clamp-2" style={{ color: 'var(--text-muted)' }}>
        {info.getValue()}
      </span>
    ),
    enableSorting: false,
  }),
  helper.accessor('tags', {
    header: 'Tags',
    cell: info => (
      <div className="flex flex-wrap gap-1">
        {info.getValue().slice(0, 4).map(t => (
          <span key={t} className="th-tag">{t}</span>
        ))}
      </div>
    ),
    enableSorting: false,
  }),
];

function exportCSV(rows: Entity[], type: EntityType) {
  const header = ['id', 'label', 'type', 'blurb', 'tags', 'aliases'];
  const lines = rows.map(e => [
    e.id,
    `"${e.label.replace(/"/g, '""')}"`,
    e.type,
    `"${(e.blurb ?? '').replace(/"/g, '""')}"`,
    `"${e.tags.join(', ')}"`,
    `"${e.aliases.join(', ')}"`,
  ].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `esopipe-${type}s.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function EntityTable({ entities, type }: { entities: Entity[]; type: EntityType }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data: entities,
    columns: COLUMNS,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div
      className="overflow-hidden"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: 'var(--bg-surface)',
      }}
    >
      {/* Table toolbar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={`Filter ${TYPE_LABELS[type].toLowerCase()}…`}
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="text-sm bg-transparent outline-none"
            style={{ color: 'var(--text)', fontFamily: 'var(--font-body)' }}
          />
        </div>
        <button
          onClick={() => exportCSV(
            table.getFilteredRowModel().rows.map(r => r.original),
            type
          )}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 transition-opacity hover:opacity-80"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-text)',
            border: 'none',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} style={{ borderBottom: '1px solid var(--border)' }}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)', cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        header.column.getIsSorted() === 'asc' ? <ArrowUp size={11} /> :
                        header.column.getIsSorted() === 'desc' ? <ArrowDown size={11} /> :
                        <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: i < table.getRowModel().rows.length - 1 ? '1px solid var(--border)' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3 align-top" style={{ color: 'var(--text)' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No results
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        {table.getFilteredRowModel().rows.length} of {entities.length} rows
      </div>
    </div>
  );
}

export function Tables() {
  const { data, loading } = useApp();
  const [activeType, setActiveType] = useState<EntityType>('thinker');

  const byType = useMemo(() => {
    const map: Partial<Record<EntityType, Entity[]>> = {};
    (data?.entities ?? []).forEach(e => {
      if (!map[e.type]) map[e.type] = [];
      map[e.type]!.push(e);
    });
    return map;
  }, [data]);

  const availableTypes = TYPE_ORDER.filter(t => (byType[t]?.length ?? 0) > 0);

  if (loading) return <div className="p-8" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
        >
          Relational Tables
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Browse the entity archive by type. Sortable, filterable, and exportable to CSV.
        </p>
      </div>

      {/* Type tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {availableTypes.map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className="text-sm px-4 py-2 transition-colors"
            style={{
              background: activeType === type ? 'var(--primary)' : 'var(--bg-surface)',
              color: activeType === type ? 'var(--primary-text)' : 'var(--text)',
              border: '1px solid',
              borderColor: activeType === type ? 'var(--primary)' : 'var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            {TYPE_LABELS[type]}
            <span
              className="ml-2 text-xs"
              style={{ opacity: 0.7, fontFamily: 'var(--font-mono)' }}
            >
              {byType[type]?.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      {byType[activeType] && (
        <EntityTable entities={byType[activeType]!} type={activeType} />
      )}
    </div>
  );
}
