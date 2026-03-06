import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Search as SearchIcon, MessageSquare, FlaskConical, ArrowRight,
    Users, Layers, CalendarDays, BookOpen,
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { useTrail } from '../contexts/TrailContext';
import type { SearchResultType } from '../types';

// ─── Unified search item (all types) ────────────────────────────────────────────
interface SearchItem {
    id: string;
    type: SearchResultType | 'conversation' | 'alchemy' | 'topic';
    title: string;
    excerpt: string;
    tags: string[];
    href: string;
}

function buildIndex(data: ReturnType<typeof useAppContext>['data']): SearchItem[] {
    if (!data) return [];
    const items: SearchItem[] = [];

    data.entities.forEach(e => items.push({
        id: `entity_${e.id}`,
        type: 'entity',
        title: e.label,
        excerpt: e.blurb.slice(0, 150),
        tags: [e.type, ...e.tags.slice(0, 3)],
        href: `/entities/${e.id}`,
    }));

    data.conversations.forEach(c => items.push({
        id: `conv_${c.id}`,
        type: 'conversation',
        title: c.title,
        excerpt: c.entity_ids.slice(0, 6).join(', '),
        tags: c.request_types,
        href: `/conversations/${c.id}`,
    }));

    data.alchemyConcepts.forEach(a => items.push({
        id: `alch_${a.id}`,
        type: 'alchemy',
        title: a.term,
        excerpt: a.definition.slice(0, 150),
        tags: [a.category],
        href: `/alchemy#${a.id}`,
    }));

    data.topics.forEach(t => items.push({
        id: `topic_${t.rank}`,
        type: 'topic',
        title: t.name,
        excerpt: t.what_it_is ? t.what_it_is.slice(0, 150) : '',
        tags: t.connections.slice(0, 3),
        href: `/topics#${t.rank}`,
    }));

    data.timelines.forEach(tl =>
        tl.events.forEach(ev => items.push({
            id: `tl_${ev.id}`,
            type: 'timeline_event',
            title: ev.title,
            excerpt: ev.description_md.replace(/[#*`]/g, '').slice(0, 150),
            tags: ev.tags,
            href: `/timelines?timeline=${tl.id}&event=${ev.id}`,
        }))
    );

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

// ─── Type config ──────────────────────────────────────────────────────────
type AnyType = SearchResultType | 'conversation' | 'alchemy' | 'topic';

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    entity:         { label: 'Entities',        icon: Users },
    conversation:   { label: 'Conversations',   icon: MessageSquare },
    alchemy:        { label: 'Alchemy',          icon: FlaskConical },
    topic:          { label: 'Topics',           icon: Layers },
    timeline_event: { label: 'Timeline Events', icon: CalendarDays },
    lesson:         { label: 'Lessons',          icon: BookOpen },
};

const TYPE_ORDER: AnyType[] = ['entity', 'conversation', 'topic', 'alchemy', 'timeline_event', 'lesson'];

// ─── Component ───────────────────────────────────────────────────────────────
export function SearchPage() {
    const { data } = useAppContext();
    const { addEntry } = useTrail();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') ?? '');
    const [typeFilter, setTypeFilter] = useState<AnyType | 'all'>('all');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);
    useEffect(() => { addEntry('/search', 'Search'); }, []);

    // Sync query into URL
    useEffect(() => {
        if (query) setSearchParams({ q: query }, { replace: true });
        else setSearchParams({}, { replace: true });
    }, [query]);

    const index = useMemo(() => buildIndex(data), [data]);

    const allResults = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [] as SearchItem[];
        const terms = q.split(/\s+/).filter(Boolean);
        return index
            .map(item => ({ item, score: scoreMatch(item, terms) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.item);
    }, [index, query]);

    const filtered = useMemo(
        () => typeFilter === 'all' ? allResults : allResults.filter(r => r.type === typeFilter),
        [allResults, typeFilter]
    );

    // Group by type in display order
    const grouped = useMemo(() => {
        const map = new Map<AnyType, SearchItem[]>();
        for (const t of TYPE_ORDER) map.set(t, []);
        for (const item of filtered) {
            const arr = map.get(item.type as AnyType) ?? [];
            arr.push(item);
            map.set(item.type as AnyType, arr);
        }
        return TYPE_ORDER.map(t => ({ type: t, items: map.get(t) ?? [] })).filter(g => g.items.length > 0);
    }, [filtered]);

    const totalCount = filtered.length;

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
                            placeholder="Search entities, conversations, alchemy, topics…"
                            className="w-full pl-11 pr-4 py-3 bg-[var(--bg-input)] border-2 border-[var(--border)] focus:border-[var(--primary)] rounded-lg text-base outline-none transition-colors"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </div>
                    {/* Type filter pills */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                        <FilterPill label="All" active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} />
                        {TYPE_ORDER.map(t => {
                            const count = allResults.filter(r => r.type === t).length;
                            if (count === 0) return null;
                            return (
                                <FilterPill
                                    key={t}
                                    label={`${TYPE_CONFIG[t]?.label ?? t} (${count})`}
                                    active={typeFilter === t}
                                    onClick={() => setTypeFilter(t)}
                                />
                            );
                        })}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-auto">
                <div className="max-w-2xl mx-auto py-4 px-6">
                    {query && totalCount === 0 && (
                        <div className="py-12 text-center text-[var(--text-muted)] italic text-sm">No results for "{query}".</div>
                    )}
                    {!query && (
                        <div className="py-12 text-center text-[var(--text-muted)] text-sm space-y-1">
                            <p>Search across {data?.entities.length ?? 0} entities, {data?.conversations.length ?? 0} conversations,</p>
                            <p>{data?.alchemyConcepts.length ?? 0} alchemy concepts, and {data?.topics.length ?? 0} topics.</p>
                        </div>
                    )}

                    {grouped.map(({ type, items }) => {
                        const cfg = TYPE_CONFIG[type];
                        const Icon = cfg?.icon ?? SearchIcon;
                        return (
                            <div key={type} className="mb-8">
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon size={14} className="text-[var(--primary)]" />
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                                        {cfg?.label ?? type}
                                    </h2>
                                    <span className="text-[10px] text-[var(--text-muted)] ml-1">({items.length})</span>
                                </div>
                                <div className="space-y-2">
                                    {items.slice(0, 10).map(item => (
                                        <ResultCard
                                            key={item.id}
                                            item={item}
                                            query={query}
                                            onClick={() => navigate(item.href)}
                                        />
                                    ))}
                                    {items.length > 10 && (
                                        <p className="text-xs text-[var(--text-muted)] italic pl-2">
                                            …and {items.length - 10} more. Refine your query to narrow results.
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active
                ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]'
                : 'bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-muted)]'
                }`}
        >
            {label}
        </button>
    );
}

function ResultCard({ item, query, onClick }: { item: SearchItem; query: string; onClick: () => void }) {
    const cfg = TYPE_CONFIG[item.type];
    const Icon = cfg?.icon ?? ArrowRight;
    const highlighted = highlightMatch(item.title, query);

    return (
        <div
            onClick={onClick}
            className="flex items-start gap-3 p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--primary)] transition-colors group"
        >
            <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center bg-[var(--primary)]/10">
                <Icon size={15} className="text-[var(--primary)]" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <h3
                        className="font-semibold text-sm text-[var(--text-heading)]"
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                    />
                    <ArrowRight size={12} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                </div>
                {item.excerpt && (
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{item.excerpt}</p>
                )}
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
        const escaped = term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        result = result.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="bg-[var(--primary)]/20 text-[var(--primary)] rounded px-0.5">$1</mark>');
    }
    return result;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
