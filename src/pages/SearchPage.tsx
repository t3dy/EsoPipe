import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, MessageSquare, FlaskConical, ArrowRight } from 'lucide-react';
import type { ConversationMeta, AlchemyConcept } from '../types';
import { useAppContext } from '../contexts/AppContext';

interface SearchItem {
    id: string;
    type: 'conversation' | 'alchemy';
    title: string;
    excerpt: string;
    tags: string[];
    href: string;
}

function buildIndex(conversations: ConversationMeta[], alchemy: AlchemyConcept[]): SearchItem[] {
    const items: SearchItem[] = [];
    for (const c of conversations) {
        items.push({
            id: `conv_${c.id}`,
            type: 'conversation',
            title: c.title,
            excerpt: c.entity_ids.slice(0, 6).join(', '),
            tags: c.request_types,
            href: `/conversations/${c.id}`,
        });
    }
    for (const a of alchemy) {
        items.push({
            id: `alch_${a.id}`,
            type: 'alchemy',
            title: a.term,
            excerpt: a.definition.slice(0, 150),
            tags: [a.category],
            href: `/alchemy`,
        });
    }
    return items;
}

function scoreMatch(item: SearchItem, terms: string[]): number {
    let score = 0;
    const titleLower = item.title.toLowerCase();
    const excerptLower = item.excerpt.toLowerCase();
    for (const t of terms) {
        if (titleLower.startsWith(t)) score += 10;
        else if (titleLower.includes(t)) score += 5;
        if (excerptLower.includes(t)) score += 2;
        if (item.tags.some(tag => tag.toLowerCase().includes(t))) score += 3;
    }
    return score;
}

export function SearchPage() {
    const { data } = useAppContext();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'conversation' | 'alchemy'>('all');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const index = useMemo(
        () => buildIndex(data?.conversations ?? [], data?.alchemyConcepts ?? []),
        [data]
    );

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        const terms = q.split(/\s+/).filter(Boolean);
        return index
            .filter(item => typeFilter === 'all' || item.type === typeFilter)
            .map(item => ({ item, score: scoreMatch(item, terms) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 40)
            .map(x => x.item);
    }, [index, query, typeFilter]);

    const convCount = results.filter(r => r.type === 'conversation').length;
    const alchCount = results.filter(r => r.type === 'alchemy').length;

    return (
        <div className="flex flex-col h-full bg-[var(--bg)]">
            <header className="px-6 py-6 border-b border-[var(--border)]">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <SearchIcon className="text-[var(--primary)]" size={22} />
                        <h1 className="text-xl font-bold font-serif text-[var(--text-heading)]">Search</h1>
                    </div>
                    <div className="relative">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search conversations, alchemy concepts…"
                            className="w-full pl-11 pr-4 py-3 bg-[var(--bg-input)] border-2 border-[var(--border)] focus:border-[var(--primary)] rounded-lg text-base outline-none transition-colors"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 mt-3">
                        {(['all', 'conversation', 'alchemy'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setTypeFilter(f)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${typeFilter === f
                                    ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]'
                                    : 'bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-muted)]'
                                    }`}
                            >
                                {f === 'all' ? 'All' : f === 'conversation' ? 'Conversations' : 'Alchemy'}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto">
                <div className="max-w-2xl mx-auto py-4 px-6">
                    {query && results.length === 0 && (
                        <div className="py-12 text-center text-[var(--text-muted)] italic text-sm">No results for "{query}".</div>
                    )}
                    {!query && (
                        <div className="py-12 text-center text-[var(--text-muted)] text-sm">
                            <p className="mb-2">Search across {data?.conversations.length ?? 0} conversations and {data?.alchemyConcepts.length ?? 0} alchemy concepts.</p>
                        </div>
                    )}
                    {results.length > 0 && (
                        <>
                            <p className="text-xs text-[var(--text-muted)] mb-4">
                                {results.length} result{results.length !== 1 ? 's' : ''}
                                {typeFilter === 'all' && ` · ${convCount} conversations, ${alchCount} alchemy`}
                            </p>
                            <div className="space-y-2">
                                {results.map(item => (
                                    <ResultCard
                                        key={item.id}
                                        item={item}
                                        query={query}
                                        onClick={() => navigate(item.href)}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ResultCard({ item, query, onClick }: { item: SearchItem; query: string; onClick: () => void }) {
    const Icon = item.type === 'conversation' ? MessageSquare : FlaskConical;
    const highlighted = highlightMatch(item.title, query);

    return (
        <div
            onClick={onClick}
            className="flex items-start gap-3 p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--primary)] transition-colors group"
        >
            <div className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${item.type === 'conversation' ? 'bg-[var(--primary)]/10' : 'bg-amber-900/10'}`}>
                <Icon size={15} className={item.type === 'conversation' ? 'text-[var(--primary)]' : 'text-amber-500'} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <h3
                        className="font-semibold text-sm text-[var(--text-heading)]"
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                    />
                    <ArrowRight size={12} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{item.excerpt}</p>
                {item.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                        {item.tags.slice(0, 4).map(tag => (
                            <span key={tag} className="text-[9px] bg-[var(--bg)] border border-[var(--border)] px-1.5 py-0.5 rounded uppercase tracking-wide text-[var(--text-muted)]">{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function highlightMatch(text: string, query: string): string {
    if (!query.trim()) return escapeHtml(text);
    const terms = query.trim().split(/\s+/).filter(Boolean);
    let result = escapeHtml(text);
    for (const term of terms) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-[var(--primary)]/20 text-[var(--primary)] rounded px-0.5">$1</mark>');
    }
    return result;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
