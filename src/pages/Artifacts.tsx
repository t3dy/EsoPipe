import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { BookOpen, Search, Filter, Clock, LayoutGrid, List } from 'lucide-react';
import { type Artifact } from '../types';

export function Artifacts() {
    const { data } = useAppContext();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'grid' | 'list'>('grid');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    const artifacts = data?.artifacts ?? [];

    const filtered = artifacts.filter((a: Artifact) => {
        const matchesSearch =
            a.id.toLowerCase().includes(search.toLowerCase()) ||
            a.type.toLowerCase().includes(search.toLowerCase()) ||
            (a.payload_markdown || '').toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === 'all' || a.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const types: string[] = Array.from(new Set(artifacts.map((a: Artifact) => a.type)));

    return (
        <div className="flex flex-col h-full bg-[var(--bg)]">
            <header className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BookOpen className="text-[var(--primary)]" size={24} />
                    <div>
                        <h1 className="text-xl font-bold font-serif text-[var(--text-heading)]">Scholarly Library</h1>
                        <p className="text-xs text-[var(--text-muted)]">Verified artifacts & scholarly products</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                        <input
                            type="text"
                            placeholder="Search library..."
                            className="pl-9 pr-4 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] rounded-md text-sm focus:border-[var(--primary)] outline-none w-64"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-[var(--bg-sidebar)] border border-[var(--border)] rounded-md overflow-hidden">
                        <button
                            className={`p-1.5 ${view === 'grid' ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'text-[var(--text-muted)]'}`}
                            onClick={() => setView('grid')}
                        >
                            <LayoutGrid size={14} />
                        </button>
                        <button
                            className={`p-1.5 ${view === 'grid' ? 'text-[var(--text-muted)]' : 'bg-[var(--primary)] text-[var(--primary-text)]'}`}
                            onClick={() => setView('list')}
                        >
                            <List size={14} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto p-6">
                <div className="flex gap-2 mb-6">
                    <button
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${typeFilter === 'all'
                                ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]'
                                : 'bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-muted)]'
                            }`}
                        onClick={() => setTypeFilter('all')}
                    >
                        All Artifacts
                    </button>
                    {types.map(t => (
                        <button
                            key={t}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${typeFilter === t
                                    ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]'
                                    : 'bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-muted)]'
                                }`}
                            onClick={() => setTypeFilter(t)}
                        >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-lg">
                        <Clock size={32} className="mb-2 opacity-20" />
                        <p className="text-sm italic">The library is currently empty.</p>
                        <p className="text-xs mt-1">Generate artifacts using chat commands to see them here.</p>
                    </div>
                ) : (
                    <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-2'}>
                        {filtered.map((artifact: Artifact) => (
                            <ArtifactCard
                                key={artifact.id}
                                artifact={artifact}
                                view={view}
                                onClick={() => navigate(`/artifacts/${artifact.id}`)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ArtifactCard({ artifact, view, onClick }: { artifact: Artifact, view: 'grid' | 'list', onClick: () => void }) {
    const isGrid = view === 'grid';

    return (
        <div
            className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 cursor-pointer hover:border-[var(--primary)] transition-all shadow-sm ${isGrid ? 'flex flex-col gap-3' : 'flex items-center gap-4 py-3'
                }`}
            onClick={onClick}
        >
            <div className={`rounded p-2 w-fit ${artifact.type === 'whois' ? 'bg-amber-900/10' : 'bg-blue-900/10'}`}>
                <BookOpen size={16} className={artifact.type === 'whois' ? 'text-amber-500' : 'text-blue-500'} />
            </div>

            <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-sm text-[var(--text-heading)]">
                        {artifact.type.charAt(0).toUpperCase() + artifact.type.slice(1)}: {artifact.id}
                    </h3>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">v{artifact.schema_version}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                    {artifact.payload_markdown || 'Scholarly artifact with provenance links and structured data.'}
                </p>
            </div>

            <div className={`flex items-center gap-3 text-[10px] text-[var(--text-muted)] ${isGrid ? 'mt-auto pt-3 border-t border-[var(--border)]/50' : 'shrink-0'}`}>
                <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(artifact.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                    <Filter size={10} />
                    {artifact.sources.length} sources
                </span>
            </div>
        </div>
    );
}
