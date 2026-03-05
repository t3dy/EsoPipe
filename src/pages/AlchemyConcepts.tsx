import { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { FlaskConical, Search, ChevronDown, ChevronUp } from 'lucide-react';
import type { AlchemyConcept } from '../types';

const CATEGORIES = [
    'Chemical Process', 'Operation', 'Stage', 'Substance',
    'Apparatus', 'Symbol', 'Theoretical Framework', 'Concept',
    'Practitioner', 'Uncategorized',
];

export function AlchemyConcepts() {
    const { data } = useAppContext();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [expanded, setExpanded] = useState<string | null>(null);

    const concepts: AlchemyConcept[] = data?.alchemyConcepts ?? [];

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return concepts.filter(c => {
            const matchSearch = !q ||
                c.term.toLowerCase().includes(q) ||
                c.definition.toLowerCase().includes(q);
            const matchCat = category === 'all' || c.category === category;
            return matchSearch && matchCat;
        });
    }, [concepts, search, category]);

    // Count per category
    const catCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of concepts) {
            counts[c.category] = (counts[c.category] ?? 0) + 1;
        }
        return counts;
    }, [concepts]);

    return (
        <div className="flex h-full bg-[var(--bg)]">
            {/* Left sidebar: category filter */}
            <aside className="w-52 shrink-0 border-r border-[var(--border)] bg-[var(--bg-sidebar)] overflow-auto py-3">
                <div className="px-4 pb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Category</div>
                <button
                    onClick={() => setCategory('all')}
                    className={`w-full text-left px-4 py-2 text-sm flex justify-between items-center transition-colors ${category === 'all' ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'hover:bg-[var(--bg-hover)] text-[var(--text)]'}`}
                >
                    <span>All</span>
                    <span className="text-[10px] opacity-70">{concepts.length}</span>
                </button>
                {CATEGORIES.filter(c => catCounts[c]).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`w-full text-left px-4 py-2 text-sm flex justify-between items-center transition-colors ${category === cat ? 'bg-[var(--primary)] text-[var(--primary-text)]' : 'hover:bg-[var(--bg-hover)] text-[var(--text)]'}`}
                    >
                        <span className="truncate pr-2">{cat}</span>
                        <span className="text-[10px] opacity-70 shrink-0">{catCounts[cat] ?? 0}</span>
                    </button>
                ))}
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FlaskConical className="text-[var(--primary)]" size={22} />
                        <div>
                            <h1 className="text-xl font-bold font-serif text-[var(--text-heading)]">Alchemy Concepts</h1>
                            <p className="text-xs text-[var(--text-muted)]">{filtered.length} of {concepts.length} concepts</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                        <input
                            type="text"
                            placeholder="Search terms…"
                            className="pl-9 pr-4 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] rounded-md text-sm focus:border-[var(--primary)] outline-none w-56"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </header>

                <div className="flex-1 overflow-auto divide-y divide-[var(--border)]">
                    {filtered.length === 0 ? (
                        <div className="p-10 text-center text-[var(--text-muted)] italic text-sm">No concepts match.</div>
                    ) : (
                        filtered.map(c => (
                            <ConceptRow
                                key={c.id}
                                concept={c}
                                open={expanded === c.id}
                                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function ConceptRow({ concept, open, onToggle }: { concept: AlchemyConcept; open: boolean; onToggle: () => void }) {
    // Strip leading "## Term\nTerm\n\n**Term** is " boilerplate from definition
    const cleanDef = concept.definition
        .replace(/^[A-Za-z\s]+\n/, '')  // first repeated term line
        .trim();

    return (
        <div className="px-6 py-3 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer" onClick={onToggle}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-sm text-[var(--text-heading)]">{concept.term}</h3>
                    <span className="text-[10px] bg-[var(--bg-card)] border border-[var(--border)] px-1.5 py-0.5 rounded uppercase tracking-wide text-[var(--text-muted)]">
                        {concept.category}
                    </span>
                </div>
                {open ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
            </div>
            {!open && (
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{cleanDef}</p>
            )}
            {open && (
                <div className="mt-3 space-y-3">
                    <p className="text-sm text-[var(--text)] leading-relaxed">{cleanDef}</p>
                    {concept.body && concept.body !== concept.definition && (
                        <div className="border-t border-[var(--border)] pt-3">
                            <p className="text-xs text-[var(--text)] leading-relaxed whitespace-pre-wrap opacity-80">
                                {concept.body
                                    .replace(/^##\s+[^\n]+\n/, '')
                                    .replace(/^\*\*[^*]+\*\*\s+is\s+/, '')
                                    .trim()
                                    .slice(0, 800)}
                                {concept.body.length > 900 ? '…' : ''}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
