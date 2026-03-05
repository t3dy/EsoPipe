import { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Layers, ChevronRight } from 'lucide-react';
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
    const [selected, setSelected] = useState<number>(1);

    const topics: Topic[] = data?.topics ?? [];
    const topic = topics.find(t => t.rank === selected);

    return (
        <div className="flex h-full bg-[var(--bg)]">
            {/* Sidebar: topic list */}
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
                    <TopicView topic={topic} />
                )}
            </main>
        </div>
    );
}

function TopicView({ topic }: { topic: Topic }) {
    return (
        <div className="max-w-2xl mx-auto py-8 px-6">
            <div className="mb-6">
                <div className="flex items-baseline gap-3 mb-1">
                    <span className="text-2xl font-bold font-serif text-[var(--text-heading)]">
                        {topic.rank}. {topic.name}
                    </span>
                </div>
                {topic.meta && (
                    <p className="text-xs text-[var(--text-muted)] italic">{topic.meta}</p>
                )}
            </div>

            {topic.what_it_is && (
                <Section title="What it is">
                    <p className="text-sm text-[var(--text)] leading-relaxed">{topic.what_it_is}</p>
                </Section>
            )}

            {topic.what_studied && (
                <Section title="What you've studied">
                    <div className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                        {topic.what_studied}
                    </div>
                </Section>
            )}

            {topic.connections.length > 0 && (
                <Section title="Key connections">
                    <div className="flex flex-wrap gap-2">
                        {topic.connections.map(c => (
                            <span key={c} className="text-xs bg-[var(--bg-card)] border border-[var(--border)] px-2 py-1 rounded text-[var(--text-muted)]">
                                {c}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {topic.open_questions && (
                <Section title="Open questions">
                    <div className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                        {topic.open_questions}
                    </div>
                </Section>
            )}
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
