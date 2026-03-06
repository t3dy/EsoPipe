/**
 * TrailContext — session-based reading trail.
 *
 * Records every page visit as a {route, label, timestamp} entry.
 * Persisted in sessionStorage so it survives page refresh within
 * the same tab, but resets when the tab is closed.
 *
 * Usage in page components:
 *   const { addEntry } = useTrail();
 *   useEffect(() => { addEntry('/entities/thinker_ficino', 'Ficino'); }, []);
 */

import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'esopipe_trail_v1';
const MAX_ENTRIES = 30;

export interface TrailEntry {
  route: string;
  label: string;
  timestamp: number;
}

interface TrailCtx {
  trail: TrailEntry[];
  addEntry: (route: string, label: string) => void;
  clear: () => void;
}

const TrailContext = createContext<TrailCtx | null>(null);

function loadTrail(): TrailEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveTrail(t: TrailEntry[]) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch { /* quota */ }
}

export function TrailProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<TrailEntry[]>(loadTrail);

  const addEntry = useCallback((route: string, label: string) => {
    setTrail(prev => {
      // Deduplicate: remove any older entry for same route, prepend new one
      const entry: TrailEntry = { route, label, timestamp: Date.now() };
      const next = [entry, ...prev.filter(e => e.route !== route)].slice(0, MAX_ENTRIES);
      saveTrail(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setTrail([]);
    saveTrail([]);
  }, []);

  return (
    <TrailContext.Provider value={{ trail, addEntry, clear }}>
      {children}
    </TrailContext.Provider>
  );
}

export function useTrail() {
  const ctx = useContext(TrailContext);
  if (!ctx) throw new Error('useTrail must be used inside TrailProvider');
  return ctx;
}
