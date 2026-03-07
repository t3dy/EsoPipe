/**
 * ChatPanel — collapsible right-side LLM chat drawer.
 *
 * Opens/closes via the toggle button in the top bar.
 * Streams responses from /llm/chat via the ChatContext.
 */
import {
  useEffect, useRef, useState, type KeyboardEvent, type FormEvent,
} from 'react';
import {
  X, Send, Trash2, Bot, User, Loader2, Wifi, WifiOff,
  ToggleLeft, ToggleRight, ChevronDown, MessageSquare,
} from 'lucide-react';
import { useChat } from '../contexts/ChatContext';

// ── Markdown renderer (lightweight, no extra deps) ─────────────────────────────
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^#{1,3}\s+(.+)$/gm, '<strong>$1</strong>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

// ── Single message bubble ──────────────────────────────────────────────────────
function MessageBubble({ role, content, streaming }: {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-3`}>
      {/* Avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: isUser ? 'var(--primary)' : 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        {isUser
          ? <User size={13} style={{ color: 'var(--primary-text)' }} />
          : <Bot size={13} style={{ color: 'var(--primary)' }} />
        }
      </div>

      {/* Bubble */}
      <div
        className="max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed"
        style={{
          background: isUser ? 'var(--primary)' : 'var(--bg-card)',
          color: isUser ? 'var(--primary-text)' : 'var(--text)',
          border: isUser ? 'none' : '1px solid var(--border)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {isUser ? (
          <span>{content}</span>
        ) : (
          <>
            <span
              dangerouslySetInnerHTML={{
                __html: `<p>${renderMarkdown(content || '')}</p>`
              }}
              style={{ lineHeight: '1.6' }}
            />
            {streaming && (
              <span
                className="inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse"
                style={{ background: 'var(--primary)', borderRadius: '1px' }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Model selector dropdown ────────────────────────────────────────────────────
function ModelSelector() {
  const { llmStatus, model, setModel } = useChat();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayModel = model.split(':')[0]; // strip tag for brevity

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
        style={{
          background: 'var(--bg-hover)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
        title="Select model"
      >
        {displayModel}
        <ChevronDown size={10} />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 rounded-md shadow-lg py-1 z-50 min-w-[160px]"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {llmStatus.models.length === 0 ? (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              No models available
            </div>
          ) : (
            llmStatus.models.map(m => (
              <button
                key={m}
                onClick={() => { setModel(m); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                style={{
                  background: m === model ? 'var(--primary)' : 'transparent',
                  color: m === model ? 'var(--primary-text)' : 'var(--text)',
                }}
                onMouseEnter={e => {
                  if (m !== model) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={e => {
                  if (m !== model) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                {m}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ running }: { running: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <Bot size={36} style={{ color: 'var(--text-muted)', opacity: 0.4 }} className="mb-3" />
      {running ? (
        <>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-heading)' }}>
            Archive Assistant
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Ask anything about the esoteric studies archive. The assistant draws on 249
            research conversations and your PDF library for context.
          </p>
          <div className="mt-4 text-left space-y-1">
            {[
              'What does the archive say about Plotinus?',
              'Compare Ficino and Agrippa on natural magic.',
              'What aspects of Kabbalah came up most?',
            ].map(q => (
              <div
                key={q}
                className="text-xs px-3 py-1.5 rounded cursor-default"
                style={{
                  background: 'var(--bg-hover)',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  border: '1px solid var(--border)',
                }}
              >
                "{q}"
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-heading)' }}>
            Ollama not running
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Start Ollama to enable the LLM assistant. Then pull the default model:
          </p>
          <code
            className="mt-3 px-3 py-2 rounded text-xs block"
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ollama pull qwen2.5:14b
          </code>
        </>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export function ChatPanel() {
  const {
    panelOpen, setPanelOpen,
    messages, clearMessages,
    sendMessage, isLoading,
    llmStatus,
    useRetrieval, setUseRetrieval,
  } = useChat();

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea on open
  useEffect(() => {
    if (panelOpen) {
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [panelOpen]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!panelOpen) return null;

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: '380px',
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg-sidebar)',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          minHeight: '52px',
        }}
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
          <span className="text-sm font-bold" style={{
            color: 'var(--text-heading)',
            fontFamily: 'var(--font-heading)',
          }}>
            Archive Assistant
          </span>
          {/* Ollama status dot */}
          <span
            className="w-2 h-2 rounded-full"
            title={llmStatus.running ? `Ollama running (${llmStatus.models.length} models)` : 'Ollama offline'}
            style={{ background: llmStatus.running ? '#22c55e' : '#ef4444' }}
          />
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              title="Clear chat"
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setPanelOpen(false)}
            title="Close chat"
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyState running={llmStatus.running} />
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                role={msg.role}
                content={msg.content}
                streaming={msg.streaming}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <Bot size={13} style={{ color: 'var(--primary)' }} />
                </div>
                <div
                  className="px-3 py-2 rounded-lg flex items-center gap-1"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Controls bar ──────────────────────────────────────────────────── */}
      <div
        className="px-3 py-2 flex items-center gap-2 shrink-0"
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        {/* Retrieval toggle */}
        <button
          onClick={() => setUseRetrieval(!useRetrieval)}
          className="flex items-center gap-1 text-xs transition-colors"
          title={useRetrieval ? 'Archive context ON — click to disable' : 'Archive context OFF — click to enable'}
          style={{ color: useRetrieval ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          {useRetrieval
            ? <ToggleRight size={16} />
            : <ToggleLeft size={16} />
          }
          <span className="text-[10px] uppercase tracking-wide">
            {useRetrieval ? 'Archive' : 'Raw'}
          </span>
        </button>

        <div className="flex-1" />

        {/* Ollama status */}
        <div className="flex items-center gap-1">
          {llmStatus.running
            ? <Wifi size={12} style={{ color: '#22c55e' }} />
            : <WifiOff size={12} style={{ color: '#ef4444' }} />
          }
          {llmStatus.running && <ModelSelector />}
        </div>
      </div>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="px-3 pb-3 shrink-0"
      >
        <div
          className="flex gap-2 items-end rounded-lg p-2"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={llmStatus.running ? 'Ask the archive…' : 'Ollama not running'}
            disabled={!llmStatus.running || isLoading}
            className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
            style={{
              color: 'var(--text)',
              fontFamily: 'var(--font-body)',
              minHeight: '24px',
              maxHeight: '120px',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !llmStatus.running}
            className="shrink-0 p-1.5 rounded-md transition-all"
            style={{
              background: (!input.trim() || isLoading || !llmStatus.running)
                ? 'var(--bg-hover)'
                : 'var(--primary)',
              color: (!input.trim() || isLoading || !llmStatus.running)
                ? 'var(--text-muted)'
                : 'var(--primary-text)',
            }}
            title="Send (Enter)"
          >
            {isLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />
            }
          </button>
        </div>
        <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
          Enter to send · Shift+Enter for newline
        </p>
      </form>
    </div>
  );
}
