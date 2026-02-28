import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import {
    ArrowLeft, Clock, Info, ExternalLink, Link as LinkIcon,
    MessageSquare, Table2, User, FileText, ChevronRight
} from 'lucide-react';
import { type ArtifactSource } from '../types';

export function ArtifactDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data } = useAppContext();

    const artifact = (data?.artifacts ?? []).find(a => a.id === id);

    if (!artifact) {
        return (
            <div className="p-10 text-center">
                <h2 className="text-xl font-bold text-[var(--text-heading)]">Artifact not found</h2>
                <p className="text-[var(--text-muted)] mt-2">The artifact with ID "{id}" does not exist in the library.</p>
                <button
                    onClick={() => navigate('/artifacts')}
                    className="mt-4 px-4 py-2 bg-[var(--primary)] text-[var(--primary-text)] rounded-md text-sm"
                >
                    Back to Library
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg)]">
            <header className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/artifacts')}
                        className="p-1.5 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-muted)] transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] bg-[var(--bg-sidebar)] border border-[var(--border)] px-1.5 py-0.5 rounded uppercase tracking-wider text-[var(--text-muted)]">
                                {artifact.type}
                            </span>
                            <h1 className="text-xl font-bold font-serif text-[var(--text-heading)]">Artifact {artifact.id}</h1>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(artifact.created_at).toLocaleString()}</span>
                            <span className="flex items-center gap-1">v{artifact.schema_version}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Action buttons could go here */}
                </div>
            </header>

            <div className="flex-1 overflow-auto flex">
                <main className="flex-1 p-8 overflow-auto">
                    <div className="max-w-3xl mx-auto">
                        {/* Payload View */}
                        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-sm overflow-hidden mb-8">
                            <div className="px-4 py-2 bg-[var(--bg-sidebar)] border-b border-[var(--border)] flex items-center justify-between">
                                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Product Content</span>
                            </div>
                            <div className="p-6 prose prose-invert prose-sm max-w-none">
                                {artifact.payload_markdown ? (
                                    <div dangerouslySetInnerHTML={{ __html: formatMarkdown(artifact.payload_markdown) }} />
                                ) : (
                                    <pre className="text-xs bg-[#0f0f0f] p-4 rounded overflow-auto border border-white/5">
                                        {JSON.stringify(artifact.payload, null, 2)}
                                    </pre>
                                )}
                            </div>
                        </div>

                        {/* Context Snapshot Debugger (Optional Section) */}
                        {artifact.context_snapshot && (
                            <details className="mt-8 group border border-[var(--border)] rounded-lg overflow-hidden">
                                <summary className="px-4 py-2 bg-[var(--bg-sidebar)] cursor-pointer list-none flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors">
                                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tight">Context Snapshot (Debugger)</span>
                                    <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
                                </summary>
                                <div className="p-4 bg-[#0f0f0f] text-[10px] font-mono text-amber-500 overflow-auto max-h-[400px]">
                                    <pre>{JSON.stringify(artifact.context_snapshot, null, 2)}</pre>
                                </div>
                            </details>
                        )}
                    </div>
                </main>

                {/* Provenance Sidebar */}
                <aside className="w-80 border-l border-[var(--border)] bg-[var(--bg-sidebar)] p-6 overflow-auto">
                    <div className="flex items-center gap-2 mb-6 text-[var(--primary)]">
                        <LinkIcon size={16} />
                        <h2 className="text-sm font-bold uppercase tracking-wider">Provenance Links</h2>
                    </div>

                    <div className="space-y-4">
                        {artifact.sources.length === 0 ? (
                            <p className="text-xs italic text-[var(--text-muted)]">No explicit sources tracked.</p>
                        ) : (
                            artifact.sources.map((source: ArtifactSource, idx: number) => (
                                <SourceLink key={idx} source={source} />
                            ))
                        )}
                    </div>

                    <div className="mt-10 pt-6 border-t border-[var(--border)]">
                        <div className="flex items-center gap-2 mb-4 text-[var(--text-muted)]">
                            <Info size={14} />
                            <h3 className="text-xs font-bold uppercase tracking-wider">Metadata</h3>
                        </div>
                        <div className="space-y-2 text-[10px] font-mono">
                            <div className="flex justify-between">
                                <span className="text-[var(--text-muted)]">Revision</span>
                                <span>{artifact.revision_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--text-muted)]">Schema</span>
                                <span>{artifact.schema_version}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--text-muted)]">ID</span>
                                <span>{artifact.id}</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}

function SourceLink({ source }: { source: ArtifactSource }) {
    const Icon = source.source_type === 'turn' ? MessageSquare :
        source.source_type === 'table' ? Table2 :
            source.source_type === 'entity' ? User : FileText;

    return (
        <div className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-md hover:border-[var(--primary)] cursor-pointer transition-colors group">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <Icon size={12} className="text-[var(--text-muted)]" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-tight">{source.source_type}</span>
                </div>
                <ExternalLink size={10} className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-xs font-bold text-[var(--text-heading)] truncate">
                {source.source_id}
            </div>
        </div>
    );
}

// Simple markdown-ish formatter (since we don't have a full md parser in this scope yet)
function formatMarkdown(text: string): string {
    return text
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br />');
}
