import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useTrail } from '../contexts/TrailContext';
import { Layers, ChevronRight, ChevronLeft, Link2, Link2Off } from 'lucide-react';
import { LinkifyText } from '../components/LinkifyText';
import type { Topic } from '../types';

const TIERS = [
    { label: 'Foundations', range: [1, 10] },
    { label: 'Renaissance Core', range: [11, 20] },
    { label: 'Specialists', range: [21, 30] },
    { label: 'Specific Texts', range: [31, 40] },
    { label: 'Islamic & Late', range: [41, 50] },
];

export function Topics() {
    const { data } = useAppContext();
    const { addEntry } = useTrail();
    const [selected, setSelected] = useState<number>(1);
    const [linkingOn, setLinkingOn] = useState(true);

    const topics: Topic[] = data?.topics ?? [];
    const sortedRanks = [...topics].map(t => t.rank).sort((a, b) => a - b);
    const topic = topics.find(t => t.rank === selected);
    const currentIdx = sortedRanks.indexOf(selected);
    const prevRank = currentIdx > 0 ? sortedRanks[currentIdx - 1] : null;
    const nextRank = currentIdx < sortedRanks.length - 1 ? sortedRanks[currentIdx + 1] : null;

    const goTo = useCallback((rank: number) => setSelected(rank), []);

    useEffect(() => {
        if (topic) addEntry(`/topics#${topic.rank}`, topic.name);
    }, [selected, topic?.name]);

    // Keyboard navigation: ↑ prev topic, ↓ next topic
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (e.key === 'ArrowUp' && prevRank != null) { e.preventDefault(); goTo(prevRank); }
            if (e.key === 'ArrowDown' && nextRank != null) { e.preventDefault(); goTo(nextRank); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [prevRank, nextRank, goTo]);

    return (
        <div className="flex h-full bg-[var(--bg)]">
            {/* Sidebar */}
            <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--bg-sidebar)] overflow-auto">
                <div className="px-4 py-4 border-b border-[var(--border)] flex items-center gap-2">
                    <Layers className="text-[var(--primary)]" size={18} />
                    <div>
                        <div className="text-sm font-bold text-[var(--text-heading)]">Top 50 Topics</div>
                        <div className="text-xs text-[var(--text-muted)]">by study depth</div>
                    </div>
                </div>
                {TIERS.map(tier => {
                    const tierTopics = topics.filter(t => t.rank >= tier.range[0] && t.rank <= tier.range[1]);
                    return (
                        <div key={tier.label}>
                            <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg)]">
                                {tier.label}
                            </div>
                            {tierTopics.map(t => (
                                <button
                                    key={t.rank}
                                    onClick={() => setSelected(t.rank)}
                                    className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors hover:bg-[var(--bg-hover)] ${selected === t.rank ? 'bg-[var(--primary)]/10 border-l-2 border-[var(--primary)]' : ''}`}
                                >
                                    <span className="text-[10px] text-[var(--text-muted)] font-mono w-5 shrink-0">{t.rank}.</span>
                                    <span className={`text-sm truncate ${selected === t.rank ? 'text-[var(--primary)] font-semibold' : 'text-[var(--text)]'}`}>
                                        {t.name}
                                    </span>
                                    {selected === t.rank && <ChevronRight size={12} className="text-[var(--primary)] ml-auto shrink-0" />}
                                </button>
                            ))}
                        </div>
                    );
                })}
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                {!topic ? (
                    <div className="p-10 text-center text-[var(--text-muted)] italic">Select a topic from the sidebar.</div>
                ) : (
                    <TopicView
                        topic={topic}
                        linkingOn={linkingOn}
                        onToggleLinking={() => setLinkingOn(v => !v)}
                        prevRank={prevRank}
                        nextRank={nextRank}
                        prevName={prevRank != null ? topics.find(t => t.rank === prevRank)?.name : undefined}
                        nextName={nextRank != null ? topics.find(t => t.rank === nextRank)?.name : undefined}
                        onNavigate={goTo}
                        totalCount={sortedRanks.length}
                    />
                )}
            </main>
        </div>
    );
}

function TopicView({
    topic,
    linkingOn,
    onToggleLinking,
    prevRank,
    nextRank,
    prevName,
    nextName,
    onNavigate,
    totalCount,
}: {
    topic: Topic;
    linkingOn: boolean;
    onToggleLinking: () => void;
    prevRank: number | null;
    nextRank: number | null;
    prevName?: string;
    nextName?: string;
    onNavigate: (rank: number) => void;
    totalCount: number;
}) {
    return (
        <div className="max-w-2xl mx-auto py-8 px-6" id={String(topic.rank)}>
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-2xl font-bold font-serif text-[var(--text-heading)]">
                            {topic.rank}. {topic.name}
                        </span>
                    </div>
                    {topic.meta && (
                        <p className="text-xs text-[var(--text-muted)] italic">{topic.meta}</p>
                    )}
                </div>
                {/* Linking toggle */}
                <button
                    onClick={onToggleLinking}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors"
                    style={{
                        color: linkingOn ? 'var(--primary)' : 'var(--text-muted)',
                        borderColor: linkingOn ? 'var(--primary)' : 'var(--border)',
                        background: linkingOn ? 'var(--primary)/5' : 'transparent',
                    }}
                    title={linkingOn ? 'Disable topic linking' : 'Enable topic linking'}
                >
                    {linkingOn ? <Link2 size={12} /> : <Link2Off size={12} />}
                    Links
                </button>
            </div>

            {topic.what_it_is && (
                <Section title="What it is">
                    <p className="text-sm text-[var(--text)] leading-relaxed">
                        {linkingOn
                            ? <LinkifyText text={topic.what_it_is} />
                            : topic.what_it_is
                        }
                    </p>
                </Section>
            )}

            {/* Encyclopedia entry — written by Ollama/Gemini pipeline */}
            {topic.blurb_long && (
                <Section title="Encyclopedia Entry">
                    <div className="text-sm text-[var(--text)] leading-relaxed space-y-3">
                        {topic.blurb_long.split(/\n\n+/).map((para, i) => (
                            <p key={i}>
                                {linkingOn ? <LinkifyText text={para.trim()} /> : para.trim()}
                            </p>
                        ))}
                    </div>
                </Section>
            )}

            {/* Key Figures */}
            {topic.key_figures && topic.key_figures.length > 0 && (
                <Section title="Key Figures">
                    <div className="flex flex-wrap gap-2">
                        {topic.key_figures.map(f => (
                            <span key={f} className="text-xs bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 rounded text-[var(--text-muted)]">
                                {linkingOn ? <LinkifyText text={f} /> : f}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {/* Key Texts */}
            {topic.key_texts && topic.key_texts.length > 0 && (
                <Section title="Key Texts">
                    <div className="flex flex-wrap gap-2">
                        {topic.key_texts.map(t => (
                            <span key={t} className="text-xs bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 rounded text-[var(--text-muted)]">
                                {linkingOn ? <LinkifyText text={t} /> : t}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {/* Key Scholars */}
            {topic.key_scholars && topic.key_scholars.length > 0 && (
                <Section title="Key Scholars">
                    <div className="flex flex-wrap gap-2">
                        {topic.key_scholars.map(s => (
                            <span key={s} className="text-xs bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 rounded text-[var(--text-muted)]">
                                {linkingOn ? <LinkifyText text={s} /> : s}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {topic.what_studied && (
                <Section title="What you've studied">
                    <div className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                        {linkingOn
                            ? <LinkifyText text={topic.what_studied} />
                            : topic.what_studied
                        }
                    </div>
                </Section>
            )}

            {topic.connections.length > 0 && (
                <Section title="Key connections">
                    <div className="flex flex-wrap gap-2">
                        {topic.connections.map(c => (
                            <span key={c} className="text-xs bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 rounded text-[var(--text-muted)]">
                                {linkingOn ? <LinkifyText text={c} /> : c}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {topic.open_questions && (
                <Section title="Open questions">
                    <div className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                        {linkingOn
                            ? <LinkifyText text={topic.open_questions} />
                            : topic.open_questions
                        }
                    </div>
                </Section>
            )}

            {/* Sources — from writer pipeline */}
            {topic.sources && topic.sources.length > 0 && (
                <Section title="Sources">
                    <ul className="space-y-1">
                        {topic.sources.map((src, i) => (
                            <li key={i} className="text-xs text-[var(--text-muted)] leading-relaxed pl-3 border-l border-[var(--border)]">
                                {src}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Prev / Next navigation */}
            <div
                className="flex items-center justify-between mt-8 pt-4"
                style={{ borderTop: '1px solid var(--border)' }}
            >
                <button
                    onClick={() => prevRank != null && onNavigate(prevRank)}
                    disabled={prevRank == null}
                    className="flex items-center gap-2 text-sm transition-opacity"
                    style={{
                        background: 'none', border: 'none', cursor: prevRank != null ? 'pointer' : 'default',
                        color: prevRank != null ? 'var(--primary)' : 'var(--border)', padding: 0,
                        opacity: prevRank != null ? 1 : 0.3,
                    }}
                    title="Previous topic (↑)"
                >
                    <ChevronLeft size={14} />
                    <span>
                        {prevRank != null
                            ? <span><span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{prevRank}. </span>{prevName}</span>
                            : 'First topic'
                        }
                    </span>
                </button>
                <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {topic.rank} / {totalCount}
                </span>
                <button
                    onClick={() => nextRank != null && onNavigate(nextRank)}
                    disabled={nextRank == null}
                    className="flex items-center gap-2 text-sm transition-opacity"
                    style={{
                        background: 'none', border: 'none', cursor: nextRank != null ? 'pointer' : 'default',
                        color: nextRank != null ? 'var(--primary)' : 'var(--border)', padding: 0,
                        opacity: nextRank != null ? 1 : 0.3,
                    }}
                    title="Next topic (↓)"
                >
                    <span>
                        {nextRank != null
                            ? <span>{nextName}<span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}> .{nextRank}</span></span>
                            : 'Last topic'
                        }
                    </span>
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-2">{title}</h2>
            {children}
        </div>
    );
}
