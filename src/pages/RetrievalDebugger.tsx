import { useState } from 'react';
import { Search, Zap, Database, Filter, Info, AlertCircle } from 'lucide-react';

interface RetrievalResult {
    id: string;
    type: 'turn' | 'table' | 'entity';
    fts_score: number;
    vector_score: number;
    combined_score: number;
    text: string;
    metadata?: any;
}

export function RetrievalDebugger() {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<RetrievalResult[]>([]);
    const [activeTab, setActiveTab] = useState<'ranking' | 'context'>('ranking');

    // Mock search - in production, this would call a FastAPI / Flask endpoint
    const handleSearch = () => {
        if (!query.trim()) return;
        setIsSearching(true);

        // Simulating retrieval latency
        setTimeout(() => {
            const mockResults: RetrievalResult[] = [
                {
                    id: "turn_001",
                    type: "turn",
                    fts_score: 12.4,
                    vector_score: 0.85,
                    combined_score: 0.92,
                    text: "Count Giovanni Pico della Mirandola's synthesis of Kabbalah and Neoplatonism in the 900 Theses...",
                    metadata: { role: "assistant" }
                },
                {
                    id: "thinker_pico",
                    type: "entity",
                    fts_score: 9.2,
                    vector_score: 0.82,
                    combined_score: 0.85,
                    text: "Pico della Mirandola: Renaissance philosopher who introduced Kabbalah to modern Europe.",
                    metadata: { type: "thinker" }
                },
                {
                    id: "mined_table_042",
                    type: "table",
                    fts_score: 5.1,
                    vector_score: 0.78,
                    combined_score: 0.72,
                    text: "Table: Philosophical Comparisons. Comparison of Zoharic and Platonic emanations.",
                    metadata: { template: "phil-comp" }
                }
            ];
            setResults(mockResults);
            setIsSearching(false);
        }, 800);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg)] font-sans">
            <header className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Zap className="text-amber-500" size={24} />
                    <div>
                        <h1 className="text-xl font-bold font-serif text-[var(--text-heading)]">Retrieval Debugger</h1>
                        <p className="text-xs text-[var(--text-muted)]">Stage 1 (FTS5) + Stage 2 (Vector) Visualizer</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-auto p-6 flex flex-col gap-6">
                {/* Search Bar */}
                <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 shadow-sm">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                            <input
                                type="text"
                                placeholder="Enter scholarly query (e.g. 'Pico and the Sefirot')..."
                                className="w-full pl-12 pr-4 py-3 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-sm focus:border-[var(--primary)] outline-none transition-all"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={isSearching || !query}
                            className="px-6 py-3 bg-[var(--primary)] text-[var(--primary-text)] rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {isSearching ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={16} />}
                            Test Retrieval
                        </button>
                    </div>

                    <div className="mt-4 flex gap-6 text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">
                        <div className="flex items-center gap-2">
                            <Database size={12} className="text-blue-500" />
                            SQLite FTS5 Enabled
                        </div>
                        <div className="flex items-center gap-2">
                            <Zap size={12} className="text-amber-500" />
                            Vector Cosine Rerank
                        </div>
                    </div>
                </section>

                {results.length > 0 ? (
                    <div className="flex flex-col gap-4">
                        {/* Tabs */}
                        <div className="flex border-b border-[var(--border)]">
                            <button
                                onClick={() => setActiveTab('ranking')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ranking' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                            >
                                Ranking Trace
                            </button>
                            <button
                                onClick={() => setActiveTab('context')}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'context' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}
                            >
                                Packed Context
                            </button>
                        </div>

                        {activeTab === 'ranking' ? (
                            <div className="grid grid-cols-1 gap-4">
                                {results.map((res, i) => (
                                    <div key={res.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 flex gap-4 hover:border-[var(--primary)]/50 transition-all shadow-sm">
                                        <div className="w-10 h-10 shrink-0 bg-[var(--bg)] rounded-lg flex items-center justify-center font-bold text-[var(--primary)] border border-[var(--border)]">
                                            #{i + 1}
                                        </div>

                                        <div className="flex-1 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${res.type === 'turn' ? 'bg-blue-500/10 text-blue-500' :
                                                            res.type === 'entity' ? 'bg-purple-500/10 text-purple-500' :
                                                                'bg-amber-500/10 text-amber-500'
                                                        }`}>
                                                        {res.type}
                                                    </span>
                                                    <span className="text-xs font-mono text-[var(--text-muted)]">{res.id}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-[11px]">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[var(--text-muted)] text-[9px] uppercase tracking-tighter">FTS5</span>
                                                        <span className="font-mono text-blue-500">{res.fts_score.toFixed(1)}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[var(--text-muted)] text-[9px] uppercase tracking-tighter">Vector</span>
                                                        <span className="font-mono text-amber-500">{res.vector_score.toFixed(3)}</span>
                                                    </div>
                                                    <div className="flex flex-col items-end pl-3 border-l border-[var(--border)]">
                                                        <span className="text-[var(--text-muted)] text-[9px] uppercase tracking-tighter font-bold">Fused</span>
                                                        <span className="font-bold font-mono text-[var(--primary)]">{res.combined_score.toFixed(3)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm text-[var(--text-body)] leading-relaxed italic">
                                                "{res.text}"
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-black/90 p-6 rounded-lg font-mono text-xs text-green-500 overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                                {`### Supporting Context from Archive\n\n` +
                                    results.map((res, i) => `Source ${i + 1} [${res.type} id=${res.id}]:\n${res.text}\n`).join('\n')}
                            </div>
                        )}
                    </div>
                ) : !isSearching && (
                    <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-50">
                        <Filter size={48} className="mb-4" />
                        <p className="text-lg font-medium">Ready for validation</p>
                        <p className="text-sm">Enter a query above to see the retrieval pipeline in action.</p>
                    </div>
                )}
            </main>

            <aside className="w-80 border-l border-[var(--border)] bg-[var(--bg-sidebar)] p-6 hidden xl:block">
                <h2 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <Info size={16} className="text-[var(--primary)]" />
                    Retrieval Policy v1
                </h2>
                <div className="space-y-4 text-xs text-[var(--text-muted)]">
                    <div className="p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg">
                        <h3 className="font-bold text-[var(--text-heading)] mb-1">Stage 1 Recall</h3>
                        <p>BM25 score against SQLite FTS5 index. Captures high-precision keyword matches.</p>
                    </div>
                    <div className="p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg">
                        <h3 className="font-bold text-[var(--text-heading)] mb-1">Stage 2 Rerank</h3>
                        <p>Cosine similarity on Top 200 candidates. Captures semantic intent and topical alignment.</p>
                    </div>
                    <div className="p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg">
                        <h3 className="font-bold text-[var(--text-heading)] mb-1 text-red-400 flex items-center gap-1">
                            <AlertCircle size={10} />
                            Diversity Constraint
                        </h3>
                        <p>Deduplication threshold: 0.92. Drops highly overlapping items to maximize context diversity.</p>
                    </div>
                </div>
            </aside>
        </div>
    );
}
