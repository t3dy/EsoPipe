/**
 * ChatContext — global state for the LLM chat panel.
 *
 * Persists across page navigation.
 * Handles streaming from /llm/chat, /llm/status polling,
 * and model / retrieval preferences.
 */
import {
  createContext, useContext, useEffect, useRef, useState,
  useCallback, type ReactNode,
} from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** True while the assistant turn is still streaming */
  streaming?: boolean;
}

interface LlmStatus {
  running: boolean;
  models: string[];
}

interface ChatCtx {
  /** Is the right-side chat panel open? */
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  togglePanel: () => void;

  messages: ChatMessage[];
  clearMessages: () => void;

  /** Send a new user message and stream the assistant response */
  sendMessage: (text: string) => Promise<void>;

  /** Whether a request is in flight */
  isLoading: boolean;

  /** Ollama status (polled on panel open) */
  llmStatus: LlmStatus;
  refreshStatus: () => void;

  /** Selected model */
  model: string;
  setModel: (m: string) => void;

  /** Whether to inject RAG context from the archive */
  useRetrieval: boolean;
  setUseRetrieval: (v: boolean) => void;

  /** Optional conversation ID to pin as additional context */
  pinnedConversationId: number | null;
  pinConversation: (id: number | null) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ChatContext = createContext<ChatCtx | null>(null);

const DEFAULT_MODEL = 'qwen2.5:14b';

export function ChatProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LlmStatus>({ running: false, models: [] });
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [useRetrieval, setUseRetrieval] = useState(true);
  const [pinnedConversationId, setPinnedConversationId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── LLM status polling ─────────────────────────────────────────────────────

  const refreshStatus = useCallback(async () => {
    try {
      const r = await fetch('/llm/status', { signal: AbortSignal.timeout(3000) });
      if (!r.ok) { setLlmStatus({ running: false, models: [] }); return; }
      const data: LlmStatus = await r.json();
      setLlmStatus(data);
      // Auto-select first available model if current model is not in list
      if (data.models.length > 0 && !data.models.includes(model)) {
        setModel(data.models[0]);
      }
    } catch {
      setLlmStatus({ running: false, models: [] });
    }
  }, [model]);

  // Poll when panel opens, then every 30 s while open
  useEffect(() => {
    if (!panelOpen) return;
    refreshStatus();
    const iv = setInterval(refreshStatus, 30_000);
    return () => clearInterval(iv);
  }, [panelOpen, refreshStatus]);

  // ── Send / stream ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Append user turn
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Build history array (last 10 exchanges, excluding any currently-streaming turn)
    const history = messages
      .filter(m => !m.streaming)
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    // Placeholder streaming turn
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          message: text.trim(),
          model,
          use_retrieval: useRetrieval,
          conversation_id: pinnedConversationId,
          history,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        // Update the last (streaming) message
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: true };
          return next;
        });
      }

      // Finalise — mark as done
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: false };
        return next;
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('abort') || msg.includes('AbortError')) {
        // User cancelled — mark streaming done with whatever we have
        setMessages(prev => {
          const next = [...prev];
          if (next[next.length - 1]?.streaming) {
            next[next.length - 1] = { ...next[next.length - 1], streaming: false };
          }
          return next;
        });
      } else {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            content: `*[Error: ${msg}. Is Ollama running? Try \`ollama serve\` in a terminal.]*`,
            streaming: false,
          };
          return next;
        });
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [isLoading, messages, model, useRetrieval, pinnedConversationId]);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  const togglePanel = useCallback(() => setPanelOpen(v => !v), []);
  const pinConversation = useCallback((id: number | null) => setPinnedConversationId(id), []);

  return (
    <ChatContext.Provider value={{
      panelOpen, setPanelOpen, togglePanel,
      messages, clearMessages,
      sendMessage, isLoading,
      llmStatus, refreshStatus,
      model, setModel,
      useRetrieval, setUseRetrieval,
      pinnedConversationId, pinConversation,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}
