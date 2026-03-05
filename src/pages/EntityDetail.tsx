import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { ArrowLeft, MessageSquare, Users, ExternalLink } from 'lucide-react';

export function EntityDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data } = useAppContext();

    if (!id || !data) return null;

    const entity = data.entities.find(e => e.id === id);
    const detail = data.entityDetails[id];

    if (!entity) {
        return (
            <div className="p-10 text-center">
                <h2 className="text-xl font-bold text-[var(--text-heading)]">Entity not found</h2>
                <p className="text-[var(--text-muted)] mt-2">"{id}" does not exist.</p>
                <button onClick={() => navigate('/graph')} className="mt-4 px-4 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-md text-sm">
                    Back to Graph
                </button>
            </div>
        );
    }

    const relatedConvs = detail
        ? data.conversations
            .filter(c => detail.conversation_ids.includes(c.id))
            .sort((a, b) => b.date.localeCompare(a.date))
        : [];

    const coEntities = (detail?.co_entities ?? [])
        .map(ce => ({ ...ce, entity: data.entities.find(e => e.id === ce.id) }))
        .filter(ce => ce.entity);

    const typeColor: Record<string, string> = {
        thinker: 'text-amber-500 bg-amber-900/10',
        text: 'text-blue-400 bg-blue-900/10',
        concept: 'text-emerald-400 bg-emerald-900/10',
        term: 'text-purple-400 bg-purple-900/10',
        tool: 'text-rose-400 bg-rose-900/10',
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg)]">
            <header className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-1.5 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-muted)] transition-colors"
                >
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold ${typeColor[entity.type] ?? 'text-[var(--text-muted)] bg-[var(--bg-card)]'}`}>
                            {entity.type}
                        </span>
                        <h1 className="text-xl font-bold font-serif text-[var(--text-heading)]">{entity.label}</h1>
                    </div>
                    {detail && (
                        <p className="text-xs text-[var(--text-muted)]">
                            {detail.mention_count} mentions · {detail.conversation_ids.length} conversations
                        </p>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-auto flex">
                {/* Main column */}
                <main className="flex-1 p-8 overflow-auto">
                    <div className="max-w-2xl mx-auto space-y-8">
                        {/* Blurb */}
                        {entity.blurb && (
                            <section>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3">About</h2>
                                <p className="text-sm text-[var(--text)] leading-relaxed">{entity.blurb}</p>
                            </section>
                        )}

                        {/* Tags */}
                        {entity.tags.length > 0 && (
                            <section>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3">Tags</h2>
                                <div className="flex flex-wrap gap-2">
                                    {entity.tags.map(tag => (
                                        <span key={tag} className="text-xs bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 rounded text-[var(--text-muted)]">{tag}</span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* External links */}
                        {entity.links.length > 0 && (
                            <section>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3">Links</h2>
                                <div className="space-y-2">
                                    {entity.links.map(link => (
                                        <a key={link.url} href={link.url} target="_blank" rel="noreferrer"
                                            className="flex items-center gap-2 text-sm text-[var(--primary)] hover:underline">
                                            <ExternalLink size={12} />
                                            {link.label}
                                        </a>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Related conversations */}
                        {relatedConvs.length > 0 && (
                            <section>
                                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-3">
                                    <MessageSquare size={12} className="inline mr-1" />
                                    Conversations ({relatedConvs.length})
                                </h2>
                                <div className="space-y-2">
                                    {relatedConvs.slice(0, 20).map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => navigate(`/conversations/${c.id}`)}
                                            className="flex items-center justify-between p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-md cursor-pointer hover:border-[var(--primary)] transition-colors group"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-[var(--text-heading)] truncate">{c.title}</p>
                                                <p className="text-xs text-[var(--text-muted)]">{c.date} · {c.turn_count} turns · {c.word_count.toLocaleString()} words</p>
                                            </div>
                                            <ArrowLeft size={12} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 rotate-180 shrink-0 ml-2" />
                                        </div>
                                    ))}
                                    {relatedConvs.length > 20 && (
                                        <p className="text-xs text-[var(--text-muted)] italic text-center">…and {relatedConvs.length - 20} more</p>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                </main>

                {/* Co-entities sidebar */}
                {coEntities.length > 0 && (
                    <aside className="w-64 border-l border-[var(--border)] bg-[var(--bg-sidebar)] p-5 overflow-auto shrink-0">
                        <div className="flex items-center gap-2 mb-4 text-[var(--primary)]">
                            <Users size={14} />
                            <h2 className="text-xs font-bold uppercase tracking-wider">Frequently Co-studied</h2>
                        </div>
                        <div className="space-y-2">
                            {coEntities.map(ce => (
                                <div
                                    key={ce.id}
                                    onClick={() => navigate(`/entities/${ce.id}`)}
                                    className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-md cursor-pointer hover:border-[var(--primary)] transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-[var(--text-heading)] truncate">{ce.entity!.label}</span>
                                        <span className="text-[10px] text-[var(--text-muted)] ml-2 shrink-0">{ce.shared} shared</span>
                                    </div>
                                    <span className="text-[10px] text-[var(--text-muted)] uppercase">{ce.entity!.type}</span>
                                </div>
                            ))}
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}
