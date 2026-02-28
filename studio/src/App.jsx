import React, { useState, useEffect } from 'react';
import { Search, Book, GitCompare, ShieldCheck, ChevronRight, Activity, Layers, ExternalLink } from 'lucide-react';
import './App.css';

const API_BASE = "http://localhost:8000";

function App() {
  const [query, setQuery] = useState("");
  const [prediction, setPrediction] = useState({ intent: "general_search", score: 0 });
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArt, setSelectedArt] = useState(null);
  const [sidecar, setSidecar] = useState([]);
  const [loading, setLoading] = useState(false);

  // Real-time Intent Prediction
  useEffect(() => {
    if (query.length > 3) {
      const delayDebounce = setTimeout(() => {
        fetch(`${API_BASE}/intent/predict?q=${encodeURIComponent(query)}`)
          .then(res => res.json())
          .then(data => setPrediction(data));
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setPrediction({ intent: "general_search", score: 0 });
    }
  }, [query]);

  // Load Artifacts
  useEffect(() => {
    fetch(`${API_BASE}/artifacts`)
      .then(res => res.json())
      .then(data => setArtifacts(data));
  }, []);

  // Load Sidecar when artifact is selected
  useEffect(() => {
    if (selectedArt) {
      setLoading(true);
      fetch(`${API_BASE}/sidecar?artifact_id=${selectedArt.id}`)
        .then(res => res.json())
        .then(data => {
          setSidecar(data);
          setLoading(false);
        });
    }
  }, [selectedArt]);

  const getIntentIcon = (intent) => {
    switch (intent) {
      case 'whois': return <Book size={18} className="text-blue-400" />;
      case 'compare': return <GitCompare size={18} className="text-purple-400" />;
      case 'audit': return <ShieldCheck size={18} className="text-emerald-400" />;
      default: return <Search size={18} className="text-slate-400" />;
    }
  };

  return (
    <div className="studio-container">
      {/* --- Sidebar: Artifact Library --- */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Layers size={20} />
          <h2>Scholarly Library</h2>
        </div>
        <div className="artifact-list">
          {artifacts.map(art => (
            <div
              key={art.id}
              className={`artifact-item ${selectedArt?.id === art.id ? 'active' : ''}`}
              onClick={() => setSelectedArt(art)}
            >
              <div className="art-meta">
                {getIntentIcon(art.type)}
                <span className="art-type">{art.type.toUpperCase()}</span>
              </div>
              <div className="art-id">{art.id}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* --- Main Area --- */}
      <main className="main-content">
        {/* Command Palette */}
        <header className="command-palette">
          <div className="search-wrapper">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="Enter intent (e.g. 'Tell me about Pico' or 'Compare X and Y')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="intent-prediction">
            <Activity size={14} />
            Predicted Intent: <span className="intent-tag">{prediction.intent}</span>
            <span className="confidence">{(prediction.score * 100).toFixed(1)}% confidence</span>
          </div>
        </header>

        {/* Artifact View */}
        <section className="viewport">
          {selectedArt ? (
            <div className="artifact-view">
              <div className="artifact-header">
                <h1>{selectedArt.type === 'whois' ? selectedArt.payload.full_name :
                  selectedArt.type === 'compare' ? `${selectedArt.payload.entity_a_id} vs ${selectedArt.payload.entity_b_id}` :
                    selectedArt.payload.claim}</h1>
                <div className="badge">v{selectedArt.version}</div>
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
          )}
        </section>
      </main>

      {/* --- Right Sidecar: Relational Context --- */}
      <aside className="sidecar">
        <div className="sidecar-header">
          <ExternalLink size={18} />
          <h3>Relational Context</h3>
        </div>
        <div className="sidecar-content">
          {loading ? (
            <div className="loader">Analyzing lateral connections...</div>
          ) : sidecar.length > 0 ? (
            sidecar.map((item, idx) => (
              <div key={idx} className="sidecar-item">
                <div className="item-meta">
                  <span className={`type-tag ${item.type}`}>{item.type}</span>
                  <span className="score">{(item.combined_score * 100).toFixed(1)} match</span>
                </div>
                <div className="item-text">{item.text.substring(0, 120)}...</div>
              </div>
            ))
          ) : (
            <p className="hint">Select an artifact to discover related archival threads.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

export default App;
