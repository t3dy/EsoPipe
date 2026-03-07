/**
 * ChatToggleButton — appears in the top bar.
 * Shows an online/offline indicator dot and toggles the ChatPanel.
 */
import { MessageSquare } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';

export function ChatToggleButton() {
  const { panelOpen, togglePanel, llmStatus } = useChat();

  return (
    <button
      onClick={togglePanel}
      title={panelOpen ? 'Close AI assistant' : 'Open AI assistant'}
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all"
      style={{
        background: panelOpen ? 'var(--primary)' : 'var(--bg-hover)',
        color: panelOpen ? 'var(--primary-text)' : 'var(--text-muted)',
        border: `1px solid ${panelOpen ? 'var(--primary)' : 'var(--border)'}`,
        fontFamily: 'var(--font-body)',
      }}
      onMouseEnter={e => {
        if (!panelOpen) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
        }
      }}
      onMouseLeave={e => {
        if (!panelOpen) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
        }
      }}
    >
      <MessageSquare size={14} />
      <span className="text-xs font-medium">AI</span>
      {/* Status dot */}
      <span
        className="w-1.5 h-1.5 rounded-full"
        title={llmStatus.running ? 'Ollama online' : 'Ollama offline'}
        style={{
          background: llmStatus.running ? '#22c55e' : '#9ca3af',
        }}
      />
    </button>
  );
}
