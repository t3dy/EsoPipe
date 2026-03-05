import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { MessageSquare, Search, Calendar, Hash } from 'lucide-react';
import type { ConversationMeta } from '../types';

const ALL_RTYPES = ['summary', 'analysis', 'comparison', 'methodology', 'timeline', 'translation', 'other'];

export function Conversations() {
    const { data } = useAppContext();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [rtype, setRtype] = useState('all');

    const conversations: ConversationMeta[] = data?.conversations ?? [];

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return conversations.filter(c => {
            const matchSearch = !q ||
                c.title.toLowerCase().includes(q) ||
                c.entity_ids.some(e => e.toLowerCase().includes(q));
            const matchRtype = rtype === 'all' || c.request_types.includes(rtype);
            return matchSearch && matchRtype;
        });
    }, [conversations, search, rtype]);

    const totalWords = filtered.reduce((s, c) => s + c.word_count, 0);

    return (
        <div className="flex flex-col h-full bg-[var(--bg)]">
            <header className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <MessageSquare className="text-[var(--primary)]" size={24} />
                    <div>
                        <h1 className="text-xl font-bold font-serif text-[var(--text-heading)]">Conversations</h1>
                        <p className="text-xs text-[var(--text-muted)]">
                            {filtered.length} of {conversations.length} · {totalWords.toLocaleString()} words
                        </p>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                    <input
                        type="text"
                        placeholder="Search title or entity…"
                        className="pl-9 pr-4 py-1.5 bg-[var(--bg-input)] border border-[var(--border)] rounded-md text-sm focus:border-[var(--primary)] outline-none w-64"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </header>

            {/* Filter chips */}
            <div className="px-6 py-3 border-b border-[var(--border)] flex gap-2 flex-wrap">
                <Chip active={rtype === 'all'} onClick={() => setRtype('all')}>All</Chip>
                {ALL_RTYPES.map(r => (
                    <Chip key={r} active={rtype === r} onClick={() => setRtype(r)}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Chip>
                ))}
            </div>

            <div className="flex-1 overflow-auto">
                {filtered.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-[var(--text-muted)] italic text-sm">
                        No conversations match.
                    </div>
                ) : (
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 bg-[var(--bg-sidebar)] z-10">
                            <tr className="text-left text-xs text-[var(--text-muted)] uppercase tracking-wider">
                                <th className="px-6 py-2 font-medium border-b border-[var(--border)]">Title</th>
                                <th className="px-4 py-2 font-medium border-b border-[var(--border)] whitespace-nowrap"><Calendar size={11} className="inline mr-1" />Date</th>
                                <th className="px-4 py-2 font-medium border-b border-[var(--border)] whitespace-nowrap"><Hash size={11} className="inline mr-1" />Turns</th>
                                <th className="px-4 py-2 font-medium border-b border-[var(--border)]">Words</th>
                                <th className="px-4 py-2 font-medium border-b border-[var(--border)]">Topics</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c, i) => (
                                <tr
                                    key={c.id}
                                    className={`cursor-pointer hover:bg-[var(--bg-hover)] transition-colors ${i % 2 === 0 ? '' : 'bg-[var(--bg-sidebar)]/30'}`}
                                    onClick={() => navigate(`/conversations/${c.id}`)}
                                >
                                    <td className="px-6 py-2.5 font-medium text-[var(--text-heading)] max-w-xs">
                                        <span className="line-clamp-1">{c.title}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-[var(--text-muted)] whitespace-nowrap text-xs">{c.date}</td>
                                    <td className="px-4 py-2.5 text-[var(--text-muted)] text-xs">{c.turn_count}</td>
                                    <td className="px-4 py-2.5 text-[var(--text-muted)] text-xs">{c.word_count.toLocaleString()}</td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex gap-1 flex-wrap">
                                            {c.request_types.slice(0, 3).map(r => (
                                                <span key={r} className="text-[10px] bg-[var(--bg-card)] border border-[var(--border)] px-1.5 py-0.5 rounded uppercase tracking-wide text-[var(--text-muted)]">{r}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active
                ? 'bg-[var(--primary)] text-[var(--primary-text)] border-[var(--primary)]'
                : 'bg-transparent text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-muted)]'
                }`}
        >
            {children}
        </button>
    );
}
