import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { ArrowLeft, User, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import type { ConversationDetail as ConvDetailType, ConvTurn } from '../types';

export function ConversationDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data } = useAppContext();
    const [conv, setConv] = useState<ConvDetailType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedTurns, setExpandedTurns] = useState<Set<number>>(new Set());

    const meta = data?.conversations.find(c => String(c.id) === id);

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        const base = import.meta.env.BASE_URL;
        fetch(`${base}data/conversations/${id}.json`)
            .then(r => {
                if (!r.ok) throw new Error('Not found');
                return r.json();
            })
            .then(d => { setConv(d); setLoading(false); })
            .catch(e => { setError(e.message); setLoading(false); });
    }, [id]);

    const toggleTurn = (idx: number) => {
        setExpandedTurns(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const expandAll = () => {
        if (conv) setExpandedTurns(new Set(conv.turns.map((_, i) => i)));
    };
    const collapseAll = () => setExpandedTurns(new Set());

    return (
        <div className="flex flex-col h-full bg-[var(--bg)]">
            <header className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-4">
                <button
                    onClick={() => navigate('/conversations')}
                    className="p-1.5 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-muted)] transition-colors"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold font-serif text-[var(--text-heading)] truncate">
                        {meta?.title ?? conv?.title ?? 'Loading…'}
                    </h1>
                    <div className="flex gap-4 text-xs text-[var(--text-muted)] mt-0.5">
                        {meta && (
                            <>
                                <span>{meta.date}</span>
                                <span>{meta.turn_count} turns</span>
                                <span>{meta.word_count.toLocaleString()} words</span>
                                <span>{meta.model}</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={expandAll}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded transition-colors"
                    >
                        <ChevronDown size={12} /> Expand all
                    </button>
                    <button
                        onClick={collapseAll}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded transition-colors"
                    >
                        <ChevronUp size={12} /> Collapse all
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto">
                {loading && (
                    <div className="p-10 text-center text-[var(--text-muted)] italic">Loading conversation…</div>
                )}
                {error && (
                    <div className="p-10 text-center text-rose-500">Error: {error}</div>
                )}
                {conv && !loading && (
                    <div className="max-w-3xl mx-auto py-6 px-4 space-y-3">
                        {conv.turns.map((turn, i) => (
                            <TurnBlock
                                key={turn.id}
                                turn={turn}
                                index={i}
                                expanded={expandedTurns.has(i)}
                                onToggle={() => toggleTurn(i)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const PREVIEW_CHARS = 300;

function TurnBlock({ turn, index, expanded, onToggle }: {
    turn: ConvTurn;
    index: number;
    expanded: boolean;
    onToggle: () => void;
}) {
    const isUser = turn.role === 'user';
    const long = turn.content.length > PREVIEW_CHARS;
    const preview = long && !expanded ? turn.content.slice(0, PREVIEW_CHARS) + '…' : turn.content;

    return (
        <div className={`flex gap-3 ${isUser ? '' : 'flex-row-reverse'}`}>
            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1 ${isUser ? 'bg-[var(--primary)]/20' : 'bg-amber-900/20'}`}>
                {isUser
                    ? <User size={14} className="text-[var(--primary)]" />
                    : <Bot size={14} className="text-amber-500" />
                }
            </div>
            <div
                className={`flex-1 rounded-lg px-4 py-3 text-sm border cursor-pointer ${isUser
                    ? 'bg-[var(--bg-card)] border-[var(--border)]'
                    : 'bg-[var(--bg-sidebar)] border-[var(--border)]'
                    }`}
                onClick={long ? onToggle : undefined}
            >
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">
                        {isUser ? 'You' : 'Assistant'} · {index + 1}
                    </span>
                    <div className="flex gap-1">
                        {turn.request_types.map(r => (
                            <span key={r} className="text-[9px] bg-[var(--bg)] border border-[var(--border)] px-1 py-0.5 rounded uppercase tracking-wide text-[var(--text-muted)]">{r}</span>
                        ))}
                        <span className="text-[9px] text-[var(--text-muted)]">{turn.word_count}w</span>
                    </div>
                </div>
                <p className="whitespace-pre-wrap text-[var(--text)] leading-relaxed text-xs">
                    {preview}
                </p>
                {long && (
                    <button className="mt-2 text-[10px] text-[var(--primary)] hover:underline">
                        {expanded ? 'Show less' : 'Show more'}
                    </button>
                )}
            </div>
        </div>
    );
}
