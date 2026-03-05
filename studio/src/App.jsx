import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Book, GitCompare, ShieldCheck, ChevronRight, Activity,
  Layers, ExternalLink, MessageSquare, Bot, User, Send, X,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle,
} from 'lucide-react';
import './App.css';

const API_BASE = import.meta.env.DEV ? "http://localhost:8000" : "";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getIntentIcon(intent) {
  switch (intent) {
    case 'whois':   return <Book size={18} className="text-blue-400" />;
    case 'compare': return <GitCompare size={18} className="text-purple-400" />;
    case 'audit':   return <ShieldCheck size={18} className="text-emerald-400" />;
    default:        return <Search size={18} className="text-slate-400" />;
  }
}

// ── Main App ─────────────────────────────────────────────────────────────────

function App() {
  // ── Existing state ────────────────────────────────────────────────────────
  const [query, setQuery]               = useState("");
  const [prediction, setPrediction]     = useState({ intent: "general_search", score: 0 });
  const [artifacts, setArtifacts]       = useState([]);
  const [selectedArt, setSelectedArt]   = useState(null);
  const [sidecarData, setSidecarData]   = useState([]);
  const [loading, setLoading]           = useState(false);
  const [alchemyMode, setAlchemyMode]   = useState(false);
  const [timelineData, setTimelineData] = useState([]);
  const [alchemyTab, setAlchemyTab]     = useState('timeline');
  const [hoveredConcept, setHoveredConcept] = useState(null);
  const conceptCache = useRef({});

  // ── Sidebar mode ──────────────────────────────────────────────────────────
  const [sidebarMode, setSidebarMode]   = useState('library'); // 'library' | 'conversations'

  // ── Conversations state ───────────────────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [convSearchPending, setConvSearchPending] = useState('');
  const [selectedConv, setSelectedConv]   = useState(null);
  const [convLoading, setConvLoading]     = useState(false);
  const [expandedTurns, setExpandedTurns] = useState(new Set());

  // ── LLM / Ollama state ────────────────────────────────────────────────────
  const [chatOpen, setChatOpen]           = useState(false);
  const [chatMessages, setChatMessages]   = useState([]);
  const [chatInput, setChatInput]         = useState('');
  const [chatStreaming, setChatStreaming]  = useState(false);
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [ollamaModels, setOllamaModels]   = useState([]);
  const [ollamaModel, setOllamaModel]     = useState('');
  const [pinnedConvId, setPinnedConvId]   = useState(null);
  const chatEndRef = useRef(null);

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/artifacts`).then(r => r.json()).then(setArtifacts).catch(() => {});
    fetch(`${API_BASE}/llm/status`).then(r => r.json()).then(data => {
      setOllamaRunning(data.running);
      setOllamaModels(data.models || []);
      if (data.models?.length > 0) setOllamaModel(data.models[0]);
    }).catch(() => {});
  }, []);

  // ── Load conversations when switching to that sidebar mode ────────────────
  useEffect(() => {
    if (sidebarMode === 'conversations') {
      fetch(`${API_BASE}/conversations?limit=200`).then(r => r.json()).then(setConversations).catch(() => {});
    }
  }, [sidebarMode]);

  // ── Debounced FTS search for conversations ────────────────────────────────
  useEffect(() => {
    if (sidebarMode !== 'conversations') return;
    const timer = setTimeout(() => {
      const url = convSearchPending.trim()
        ? `${API_BASE}/conversations?limit=200&q=${encodeURIComponent(convSearchPending)}`
        : `${API_BASE}/conversations?limit=200`;
      fetch(url).then(r => r.json()).then(setConversations).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [convSearchPending, sidebarMode]);

  // ── Scroll chat to bottom ─────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Real-time intent prediction ───────────────────────────────────────────
  useEffect(() => {
    if (query.length > 3) {
      const t = setTimeout(() => {
        fetch(`${API_BASE}/intent/predict?q=${encodeURIComponent(query)}`).then(r => r.json()).then(setPrediction);
      }, 300);
      return () => clearTimeout(t);
    } else {
      setPrediction({ intent: "general_search", score: 0 });
    }
  }, [query]);

  // ── Sidecar context when artifact selected ────────────────────────────────
  useEffect(() => {
    if (!selectedArt) return;
    setLoading(true);
    if (alchemyMode) {
      const term = selectedArt.type === 'whois' ? selectedArt.payload.full_name : selectedArt.id;
      fetch(`${API_BASE}/alchemy/search?q=${encodeURIComponent(term)}&limit=5`)
        .then(r => r.json())
        .then(data => data.length === 0 ? fetch(`${API_BASE}/alchemy/random?limit=5`).then(r => r.json()) : data)
        .then(data => { setSidecarData(data); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      fetch(`${API_BASE}/sidecar?artifact_id=${selectedArt.id}`)
        .then(r => r.json())
        .then(data => { setSidecarData(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [selectedArt, alchemyMode]);

  // ── Alchemy timeline ──────────────────────────────────────────────────────
  useEffect(() => {
    if (alchemyMode && timelineData.length === 0) {
      setLoading(true);
      fetch(`${API_BASE}/alchemy/random?limit=30`).then(r => r.json()).then(data => {
        const datedData = data.map((item, idx) => ({
          ...item, mockYear: 1200 + Math.floor(Math.random() * 500) + idx * 2
        })).sort((a, b) => a.mockYear - b.mockYear);
        setTimelineData(datedData);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [alchemyMode]);

  const handleTermHover = (term) => {
    if (conceptCache.current[term]) { setHoveredConcept(conceptCache.current[term]); return; }
    fetch(`${API_BASE}/alchemy/search?q=${term}&limit=1`).then(r => r.json()).then(data => {
      if (data?.length > 0) { conceptCache.current[term] = data[0]; setHoveredConcept(data[0]); }
    });
  };

  // ── Generate artifact ─────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key !== 'Enter' || !query.trim()) return;
    setLoading(true);
    fetch(`${API_BASE}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, intent: prediction.intent }),
    }).then(r => r.json()).then(data => {
      if (data.status === 'success') {
        fetch(`${API_BASE}/artifacts`).then(r => r.json()).then(arts => {
          setArtifacts(arts);
          const newArt = arts.find(a => a.id === data.artifact_id);
          if (newArt) { setSelectedArt(newArt); setAlchemyMode(false); }
        });
      }
    }).finally(() => { setLoading(false); setQuery(''); });
  };

  // ── Load full conversation ────────────────────────────────────────────────
  const loadConversation = useCallback((convId) => {
    setConvLoading(true);
    setSelectedConv(null);
    setExpandedTurns(new Set());
    fetch(`${API_BASE}/conversations/${convId}`)
      .then(r => r.json())
      .then(data => { setSelectedConv(data); setConvLoading(false); })
      .catch(() => setConvLoading(false));
  }, []);

  const toggleTurn = (idx) => setExpandedTurns(prev => {
    const next = new Set(prev);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    return next;
  });

  // ── LLM chat send ────────────────────────────────────────────────────────
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatStreaming) return;
    const msg = chatInput.trim();
    setChatInput('');
    const history = chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    setChatMessages(prev => [...prev,
      { role: 'user', content: msg },
      { role: 'assistant', content: '', streaming: true },
    ]);
    setChatStreaming(true);
    try {
      const response = await fetch(`${API_BASE}/llm/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversation_id: pinnedConvId, model: ollamaModel, use_retrieval: true, history }),
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setChatMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + chunk };
          return updated;
        });
      }
    } catch (err) {
      setChatMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: `*Error: ${err.message}*`, streaming: false };
        return updated;
      });
    } finally {
      setChatMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false };
        return updated;
      });
      setChatStreaming(false);
    }
  }, [chatInput, chatStreaming, chatMessages, pinnedConvId, ollamaModel]);

  const handleChatKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="studio-container">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Layers size={20} />
          <h2>EsoPipe Studio</h2>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {['library', 'conversations'].map(mode => (
            <button key={mode} onClick={() => setSidebarMode(mode)} style={{
              flex: 1, padding: '8px 4px', fontSize: '11px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', cursor: 'pointer',
              background: sidebarMode === mode ? 'var(--accent)' : 'transparent',
              color: sidebarMode === mode ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}>
              {mode === 'library' ? 'Library' : 'Convs'}
            </button>
          ))}
        </div>

        {/* Library panel */}
        {sidebarMode === 'library' && <>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => setAlchemyMode(!alchemyMode)} style={{
              width: '100%', padding: '7px', borderRadius: '6px', fontSize: '12px',
              backgroundColor: alchemyMode ? '#eab308' : '#2d2d2d',
              color: alchemyMode ? '#000' : '#888',
              fontWeight: 'bold', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '6px', transition: 'all 0.3s',
            }}>
              {alchemyMode ? '⚗️ ALCHEMY MODE: ON' : '⚗️ ALCHEMY MODE: OFF'}
            </button>
          </div>
          <div className="artifact-list">
            {artifacts.map(art => (
              <div key={art.id}
                className={`artifact-item ${selectedArt?.id === art.id ? 'active' : ''}`}
                onClick={() => setSelectedArt(art)}>
                <div className="art-meta">{getIntentIcon(art.type)}<span className="art-type">{art.type.toUpperCase()}</span></div>
                <div className="art-id">{art.id}</div>
              </div>
            ))}
          </div>
        </>}

        {/* Conversations panel */}
        {sidebarMode === 'conversations' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '0.6rem', borderBottom: '1px solid var(--border)' }}>
              <input type="text" placeholder="Full-text search…"
                value={convSearchPending} onChange={e => setConvSearchPending(e.target.value)}
                style={{
                  width: '100%', padding: '5px 8px', background: '#0f172a',
                  border: '1px solid var(--border)', borderRadius: '5px',
                  color: '#fff', fontSize: '12px', outline: 'none', boxSizing: 'border-box',
                }} />
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                {conversations.length} conversations
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {conversations.map(c => (
                <div key={c.id} onClick={() => loadConversation(c.id)} style={{
                  padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #1e293b',
                  background: selectedConv?.id === c.id ? '#1e3a5f' : 'transparent',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => { if (selectedConv?.id !== c.id) e.currentTarget.style.background = '#1e293b'; }}
                  onMouseLeave={e => { if (selectedConv?.id !== c.id) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '2px', lineHeight: 1.3 }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                    <span>{c.date}</span>
                    <span>{c.turn_count}t</span>
                    <span>{(c.word_count / 1000).toFixed(1)}k w</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="main-content" style={{
        flex: alchemyMode && sidebarMode === 'library' ? 1 : undefined,
        maxWidth: alchemyMode && sidebarMode === 'library' ? '100%' : undefined,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Command palette (library only) */}
        {sidebarMode === 'library' && (
          <header className="command-palette">
            <div className="search-wrapper">
              <Search className="search-icon" size={20} />
              <input type="text"
                placeholder={alchemyMode ? "Search the Alchemy Timeline..." : "Tell me about Pico · Compare X and Y · Audit claim…"}
                value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} />
            </div>
            {!alchemyMode && (
              <div className="intent-prediction">
                <Activity size={14} />
                Predicted Intent: <span className="intent-tag">{prediction.intent}</span>
                <span className="confidence">{(prediction.score * 100).toFixed(1)}%</span>
              </div>
            )}
          </header>
        )}

        {/* Viewport */}
        <section className="viewport" style={{
          padding: (alchemyMode || sidebarMode === 'conversations') ? '0' : '2rem',
          flex: 1, overflowY: 'auto',
        }}>
          {/* Conversation viewer */}
          {sidebarMode === 'conversations' && (
            convLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Loading conversation…
              </div>
            ) : selectedConv ? (
              <ConversationViewer
                conv={selectedConv}
                expandedTurns={expandedTurns}
                onToggleTurn={toggleTurn}
                onExpandAll={() => setExpandedTurns(new Set(selectedConv.turns.map((_, i) => i)))}
                onCollapseAll={() => setExpandedTurns(new Set())}
                pinnedConvId={pinnedConvId}
                onPinToChat={id => { setPinnedConvId(id === pinnedConvId ? null : id); setChatOpen(true); }}
              />
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <MessageSquare size={48} style={{ margin: '0 auto 1rem', opacity: 0.15, display: 'block' }} />
                <p>Select a conversation from the sidebar.</p>
              </div>
            )
          )}

          {/* Alchemy mode */}
          {sidebarMode === 'library' && alchemyMode && (
            <AlchemyView
              selectedArt={selectedArt} setSelectedArt={setSelectedArt}
              alchemyTab={alchemyTab} setAlchemyTab={setAlchemyTab}
              timelineData={timelineData} loading={loading}
              hoveredConcept={hoveredConcept} setHoveredConcept={setHoveredConcept}
              handleTermHover={handleTermHover} API_BASE={API_BASE} conceptCache={conceptCache}
            />
          )}

          {/* Standard artifact view */}
          {sidebarMode === 'library' && !alchemyMode && (
            selectedArt ? (
              <div className="artifact-view">
                <div className="artifact-header">
                  <h1>{
                    selectedArt.type === 'whois'    ? selectedArt.payload.full_name :
                    selectedArt.type === 'compare'  ? `${selectedArt.payload.entity_a_id} vs ${selectedArt.payload.entity_b_id}` :
                    selectedArt.type === 'alchemy_card' ? selectedArt.payload.term :
                    selectedArt.payload.claim
                  }</h1>
                  <div className="badge">v{selectedArt.version || '1.0'}</div>
                </div>
                <div className="artifact-body">
                  <pre>{JSON.stringify(selectedArt.payload, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <Book size={48} opacity={0.2} />
                <p>Select an artifact to begin archival review</p>
              </div>
            )
          )}
        </section>
      </main>

      {/* ── Right sidecar (library + non-alchemy only) ───────────────────── */}
      {sidebarMode === 'library' && !alchemyMode && (
        <aside className="sidecar">
          <div className="sidecar-header"><ExternalLink size={18} /><h3>Relational Context</h3></div>
          <div className="sidecar-content">
            {loading ? (
              <div className="loader">Analysing lateral connections…</div>
            ) : sidecarData.length > 0 ? (
              sidecarData.map((item, idx) => (
                <div key={idx} className="sidecar-item interactive"
                  onClick={() => setQuery(item.payload ? item.payload.claim : item.text)}
                  style={{ cursor: 'pointer', borderLeft: '3px solid #3b82f6' }}>
                  <div className="item-meta">
                    <span className={`type-tag ${item.type}`}>{item.type}</span>
                    <span className="score">{(item.combined_score * 100).toFixed(1)} match</span>
                  </div>
                  <div className="item-text">{(item.text || '').substring(0, 120)}…</div>
                </div>
              ))
            ) : (
              <p className="hint">Select an artifact to discover related archival threads.</p>
            )}
          </div>
        </aside>
      )}

      {/* ── LLM Chat panel ───────────────────────────────────────────────── */}
      {chatOpen && (
        <ChatPanel
          messages={chatMessages} input={chatInput} setInput={setChatInput}
          onSend={sendChat} onKeyDown={handleChatKey} streaming={chatStreaming}
          ollamaRunning={ollamaRunning} ollamaModels={ollamaModels}
          ollamaModel={ollamaModel} setOllamaModel={setOllamaModel}
          pinnedConvId={pinnedConvId} pinnedConvTitle={selectedConv?.title}
          onUnpin={() => setPinnedConvId(null)} chatEndRef={chatEndRef}
          onClear={() => setChatMessages([])}
        />
      )}

      {/* Chat toggle button */}
      <button onClick={() => setChatOpen(v => !v)} title={ollamaRunning ? "LLM Chat" : "Ollama offline"}
        style={{
          position: 'fixed', bottom: chatOpen ? '420px' : '20px', right: '20px',
          width: '46px', height: '46px', borderRadius: '50%',
          background: ollamaRunning ? '#3b82f6' : '#475569',
          border: 'none', cursor: 'pointer', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)', transition: 'bottom 0.25s', zIndex: 50,
        }}>
        {chatOpen ? <X size={19} /> : <Bot size={19} />}
      </button>
    </div>
  );
}

// ── Conversation Viewer ───────────────────────────────────────────────────────

const btnSmall = {
  padding: '4px 8px', fontSize: '11px', border: '1px solid #475569',
  borderRadius: '4px', background: 'transparent', color: '#94a3b8',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
};

function ConversationViewer({ conv, expandedTurns, onToggleTurn, onExpandAll, onCollapseAll, pinnedConvId, onPinToChat }) {
  const isPinned = pinnedConvId === conv.id;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '10px 18px', borderBottom: '1px solid #334155', background: '#1e293b',
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0' }}>{conv.title}</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '10px' }}>
            <span>{conv.date}</span><span>{conv.turns.length} turns</span><span>{conv.model}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => onPinToChat(conv.id)} style={{
            ...btnSmall,
            borderColor: isPinned ? '#3b82f6' : '#475569',
            background: isPinned ? '#1e3a5f' : 'transparent',
            color: isPinned ? '#60a5fa' : '#94a3b8',
          }}>
            <Bot size={11} /> {isPinned ? 'Pinned' : 'Pin to Chat'}
          </button>
          <button onClick={onExpandAll} style={btnSmall}><ChevronDown size={11} /> All</button>
          <button onClick={onCollapseAll} style={btnSmall}><ChevronUp size={11} /> Collapse</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {conv.turns.map((turn, i) => (
            <TurnBlock key={turn.id} turn={turn} index={i}
              expanded={expandedTurns.has(i)} onToggle={() => onToggleTurn(i)} />
          ))}
        </div>
      </div>
    </div>
  );
}

const PREVIEW_CHARS = 400;

function TurnBlock({ turn, index, expanded, onToggle }) {
  const isUser = turn.role === 'user';
  const long = (turn.content || '').length > PREVIEW_CHARS;
  const text = long && !expanded ? (turn.content || '').slice(0, PREVIEW_CHARS) + '…' : (turn.content || '');
  return (
    <div style={{ display: 'flex', gap: '8px', flexDirection: 'row' }}>
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, marginTop: '3px',
        background: isUser ? '#1e3a5f' : '#1a1510',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser ? <User size={12} style={{ color: '#60a5fa' }} /> : <Bot size={12} style={{ color: '#eab308' }} />}
      </div>
      <div onClick={long ? onToggle : undefined} style={{
        flex: 1, borderRadius: '7px', padding: '9px 13px',
        cursor: long ? 'pointer' : 'default',
        background: isUser ? '#1e293b' : '#111827',
        border: `1px solid ${isUser ? '#334155' : '#292524'}`,
        marginLeft: isUser ? 0 : '0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
            {isUser ? 'You' : 'Assistant'} · {index + 1}
          </span>
          <span style={{ fontSize: '10px', color: '#475569' }}>{turn.word_count}w</span>
        </div>
        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65, whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>{text}</p>
        {long && (
          <button onClick={onToggle} style={{ marginTop: '5px', background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer', padding: 0 }}>
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ messages, input, setInput, onSend, onKeyDown, streaming,
  ollamaRunning, ollamaModels, ollamaModel, setOllamaModel,
  pinnedConvId, pinnedConvTitle, onUnpin, chatEndRef, onClear }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, right: '76px', width: '420px', height: '400px',
      background: '#0f172a', border: '1px solid #334155', borderBottom: 'none',
      borderRadius: '8px 8px 0 0', display: 'flex', flexDirection: 'column',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)', zIndex: 40,
    }}>
      {/* Header */}
      <div style={{
        padding: '7px 12px', background: '#1e293b', borderBottom: '1px solid #334155',
        borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <Bot size={14} style={{ color: '#3b82f6' }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', flex: 1 }}>Research Assistant</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: ollamaRunning ? '#22c55e' : '#ef4444' }}>
          {ollamaRunning ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
          {ollamaRunning ? 'online' : 'offline'}
        </div>
        {ollamaRunning && ollamaModels.length > 0 && (
          <select value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} style={{
            fontSize: '10px', background: '#0f172a', color: '#94a3b8',
            border: '1px solid #334155', borderRadius: '4px', padding: '2px 4px', maxWidth: '110px',
          }}>
            {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}>
          <X size={12} />
        </button>
      </div>

      {/* Pinned conversation badge */}
      {pinnedConvId && (
        <div style={{
          padding: '3px 12px', background: '#1e3a5f', borderBottom: '1px solid #334155',
          fontSize: '10px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <MessageSquare size={9} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Context: {pinnedConvTitle || `Conv #${pinnedConvId}`}
          </span>
          <button onClick={onUnpin} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: 0 }}>
            <X size={9} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '1.5rem', fontStyle: 'italic', lineHeight: 1.5 }}>
            {ollamaRunning
              ? 'Ask anything about your archive.\nRetrieval context added automatically.'
              : 'Start Ollama:\n`ollama serve`\nthen `ollama pull qwen2.5:14b`'}
          </div>
        )}
        {messages.map((m, i) => <ChatMessage key={i} message={m} />)}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #334155', display: 'flex', gap: '6px' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder={ollamaRunning ? "Ask a question… (Enter to send)" : "Ollama offline"}
          disabled={!ollamaRunning || streaming} rows={2}
          style={{
            flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: '5px',
            color: '#e2e8f0', fontSize: '12px', padding: '5px 8px', resize: 'none', outline: 'none',
            fontFamily: 'inherit', opacity: (!ollamaRunning || streaming) ? 0.5 : 1,
          }} />
        <button onClick={onSend} disabled={!ollamaRunning || streaming || !input.trim()} style={{
          padding: '6px 10px', background: '#3b82f6', border: 'none', borderRadius: '5px',
          color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
          opacity: (!ollamaRunning || streaming || !input.trim()) ? 0.4 : 1,
        }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
        background: isUser ? '#1e3a5f' : '#1a1510',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser ? <User size={10} style={{ color: '#60a5fa' }} /> : <Bot size={10} style={{ color: '#eab308' }} />}
      </div>
      <div style={{ flex: 1, fontSize: '12px', lineHeight: 1.6, color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {message.content}
        {message.streaming && <span style={{ color: '#3b82f6' }}>▌</span>}
      </div>
    </div>
  );
}

// ── Alchemy View ──────────────────────────────────────────────────────────────

function AlchemyView({ selectedArt, setSelectedArt, alchemyTab, setAlchemyTab, timelineData, loading, hoveredConcept, setHoveredConcept, handleTermHover, API_BASE, conceptCache }) {
  if (selectedArt?.type === 'alchemy_card') {
    return (
      <div style={{ background: '#111', backgroundImage: 'radial-gradient(circle at center, #2a2015 0%, #111 100%)', padding: '2rem', overflowY: 'auto', height: '100%' }}>
        <button onClick={() => setSelectedArt(null)} style={{ marginBottom: '2rem', padding: '6px 14px', border: '1px solid #854d0e', color: '#eab308', background: 'transparent', borderRadius: '5px', cursor: 'pointer' }}>
          ← Back
        </button>
        <div style={{ maxWidth: '700px', margin: '0 auto', background: '#1a1510', border: '1px solid #7c2d12', borderRadius: '12px', padding: '2.5rem' }}>
          <h2 style={{ fontFamily: 'serif', fontSize: '2rem', color: '#eab308', marginBottom: '0.5rem' }}>{selectedArt.payload.term}</h2>
          <span style={{ display: 'inline-block', padding: '2px 10px', background: 'rgba(120,53,15,0.4)', color: '#f59e0b', fontSize: '11px', borderRadius: '4px', border: '1px solid rgba(180,83,9,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>{selectedArt.payload.category}</span>
          <p style={{ fontSize: '1.1rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '2rem', lineHeight: 1.7 }}>{selectedArt.payload.definition}</p>
          {selectedArt.payload.images?.[0] && (
            <div style={{ margin: '2rem 0', textAlign: 'center' }}>
              <img src={`${API_BASE}${selectedArt.payload.images[0].path}`} alt={selectedArt.payload.term} style={{ maxHeight: '400px', maxWidth: '100%', border: '2px solid #7c2d12', borderRadius: '6px', filter: 'sepia(0.35) contrast(1.1)' }} />
              <p style={{ marginTop: '0.75rem', fontSize: '13px', color: '#b45309', fontStyle: 'italic' }}>{selectedArt.payload.images[0].caption}</p>
            </div>
          )}
          <div style={{ fontSize: '1rem', color: '#d1d5db', lineHeight: 1.8 }}>
            {(selectedArt.payload.body || '').split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#111', backgroundImage: 'radial-gradient(circle at center, #2a2015 0%, #111 100%)', padding: '2rem', overflowY: 'auto', height: '100%', position: 'relative', color: '#fff' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '3rem' }}>
          {['timeline', 'tablet'].map(tab => (
            <button key={tab} onClick={() => setAlchemyTab(tab)} style={{
              padding: '10px 24px', border: `1px solid ${alchemyTab === tab ? '#eab308' : 'rgba(120,53,15,0.3)'}`,
              borderRadius: '5px', background: alchemyTab === tab ? 'rgba(120,53,15,0.3)' : 'transparent',
              color: alchemyTab === tab ? '#eab308' : '#6b7280', cursor: 'pointer', fontFamily: 'serif', fontSize: '14px',
            }}>
              {tab === 'timeline' ? 'Historical Timeline' : 'Emerald Tablet Edition'}
            </button>
          ))}
        </div>

        {alchemyTab === 'timeline' ? (
          <>
            <h1 style={{ fontFamily: 'serif', fontSize: '2.2rem', color: '#eab308', textAlign: 'center', marginBottom: '3rem' }}>Timeline of the Great Work</h1>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#b45309', fontStyle: 'italic', fontSize: '1.1rem' }}>Mining texts and dusting off manuscripts…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {timelineData.map((item, idx) => (
                  <div key={item.id} onClick={() => setSelectedArt({ type: 'alchemy_card', payload: item })}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: '1rem', flexDirection: idx % 2 === 0 ? 'row-reverse' : 'row' }}>
                    <div style={{ width: '45%' }} />
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#854d0e', border: '3px solid #eab308', flexShrink: 0 }} />
                    <div style={{ width: '45%', padding: '1.2rem', background: '#1a1510', border: '1px solid rgba(120,53,15,0.3)', borderRadius: '8px', textAlign: idx % 2 === 0 ? 'right' : 'left' }}>
                      <div style={{ fontSize: '11px', color: '#b45309', fontFamily: 'monospace', marginBottom: '4px' }}>{item.mockYear} CE</div>
                      <div style={{ fontSize: '1.1rem', fontFamily: 'serif', color: '#f59e0b', marginBottom: '4px' }}>{item.term}</div>
                      <div style={{ fontSize: '10px', color: '#92400e', textTransform: 'uppercase', marginBottom: '6px' }}>{item.category}</div>
                      <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>{item.definition}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <EmeraldTablet handleTermHover={handleTermHover} setHoveredConcept={setHoveredConcept}
            hoveredConcept={hoveredConcept} setSelectedArt={setSelectedArt} conceptCache={conceptCache} />
        )}
      </div>
    </div>
  );
}

function EmeraldTablet({ handleTermHover, setHoveredConcept, hoveredConcept, setSelectedArt, conceptCache }) {
  const T = ({ term, children }) => (
    <span style={{ color: '#eab308', borderBottom: '1px dashed #854d0e', cursor: 'pointer' }}
      onMouseEnter={() => handleTermHover(term)}
      onMouseLeave={() => setHoveredConcept(null)}
      onClick={() => setSelectedArt({ type: 'alchemy_card', payload: conceptCache.current[term] })}>
      {children}
    </span>
  );
  return (
    <div style={{ position: 'relative' }}>
      <h1 style={{ fontFamily: 'serif', fontSize: '2rem', color: '#eab308', textAlign: 'center', marginBottom: '0.5rem' }}>Tabula Smaragdina</h1>
      <div style={{ textAlign: 'center', color: 'rgba(180,83,9,0.6)', marginBottom: '3rem', fontStyle: 'italic' }}>Translated by Isaac Newton</div>
      <div style={{ fontSize: '1.2rem', fontFamily: 'serif', lineHeight: 1.9, textAlign: 'center', color: '#d1d5db', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <p>Tis true without lying, certain &amp; most true.</p>
        <p>That which is below is like that which is above &amp; that which is above is like that which is below to do the miracles of <T term="One Thing">one only thing</T>.</p>
        <p>And as all things have been &amp; arose from one by the mediation of one: so all things have their birth from this one thing by adaptation.</p>
        <p>The <T term="Sun">Sun</T> is its father, the <T term="Moon">moon</T> its mother, the <T term="Wind">wind</T> hath carried it in its belly, the <T term="Earth">earth</T> its nurse.</p>
        <p>Separate thou the earth from the <T term="Fire">fire</T>, the <T term="Subtle">subtile</T> from the <T term="Gross">gross</T> sweetly with great industry.</p>
        <p>It ascends from the earth to the heaven &amp; again it descends to the earth and receives the force of things superior &amp; inferior.</p>
        <p>By this means you shall have the <T term="Glory">glory</T> of the whole world &amp; thereby all obscurity shall fly from you.</p>
        <p>Hence I am called <T term="Hermes Trismegistus">Hermes Trismegist</T>, having the three parts of the philosophy of the whole world.</p>
      </div>
      {hoveredConcept && (
        <div style={{
          position: 'absolute', right: '-80px', top: '30%', width: '280px', padding: '1.2rem',
          background: '#1a1510', border: '1px solid #854d0e', borderRadius: '8px',
          boxShadow: '0 0 24px rgba(234,179,8,0.15)', pointerEvents: 'none', transform: 'translateX(100%)',
        }}>
          <div style={{ fontFamily: 'serif', fontSize: '1.1rem', color: '#f59e0b', marginBottom: '4px' }}>{hoveredConcept.term}</div>
          <div style={{ fontSize: '10px', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{hoveredConcept.category}</div>
          <p style={{ fontSize: '12px', color: '#d1d5db', lineHeight: 1.5, fontStyle: 'italic', margin: 0 }}>{hoveredConcept.definition}</p>
        </div>
      )}
    </div>
  );
}

export default App;
