/**
 * AnnotationContext — user research notes attached to any archive object.
 *
 * Static mode: persisted in localStorage (up to ~5 MB, ~50 k notes).
 * Desktop mode: also syncs with FastAPI /annotations endpoint.
 *
 * Schema: see Annotation interface in types/index.ts
 */

import {
  createContext, useContext, useState, useCallback, useEffect,
  type ReactNode,
} from 'react';
import { useApp } from './AppContext';
import type { Annotation } from '../types';

const STORAGE_KEY = 'esopipe_annotations_v1';

function loadLocal(): Annotation[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}
function saveLocal(a: Annotation[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch { /* quota */ }
}

interface AnnotationCtx {
  annotations: Annotation[];
  getByTarget: (targetId: string) => Annotation[];
  add: (partial: Omit<Annotation, 'id' | 'created_at' | 'updated_at'>) => void;
  update: (id: string, text: string, tags: string[]) => void;
  remove: (id: string) => void;
}

const AnnotationContext = createContext<AnnotationCtx | null>(null);

function makeId() {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function AnnotationProvider({ children }: { children: ReactNode }) {
  const { isDesktop } = useApp();
  const [annotations, setAnnotations] = useState<Annotation[]>(loadLocal);

  // On desktop mode: hydrate from server on mount
  useEffect(() => {
    if (!isDesktop) return;
    fetch('http://127.0.0.1:3000/annotations')
      .then(r => r.ok ? r.json() : [])
      .then((rows: Annotation[]) => {
        setAnnotations(rows);
        saveLocal(rows);
      })
      .catch(() => { /* server unreachable — fall back to localStorage */ });
  }, [isDesktop]);

  const persist = useCallback((next: Annotation[]) => {
    setAnnotations(next);
    saveLocal(next);
  }, []);

  const add = useCallback((partial: Omit<Annotation, 'id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString();
    const ann: Annotation = { ...partial, id: makeId(), created_at: now, updated_at: now };
    persist([ann, ...annotations]);

    if (isDesktop) {
      fetch('http://127.0.0.1:3000/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ann),
      }).catch(() => { /* ignore — local copy already saved */ });
    }
  }, [annotations, isDesktop, persist]);

  const update = useCallback((id: string, text: string, tags: string[]) => {
    const now = new Date().toISOString();
    const next = annotations.map(a =>
      a.id === id ? { ...a, text, tags, updated_at: now } : a
    );
    persist(next);
  }, [annotations, persist]);

  const remove = useCallback((id: string) => {
    const next = annotations.filter(a => a.id !== id);
    persist(next);
    if (isDesktop) {
      fetch(`http://127.0.0.1:3000/annotations/${id}`, { method: 'DELETE' })
        .catch(() => { /* ignore */ });
    }
  }, [annotations, isDesktop, persist]);

  const getByTarget = useCallback(
    (targetId: string) => annotations.filter(a => a.target_id === targetId),
    [annotations]
  );

  return (
    <AnnotationContext.Provider value={{ annotations, getByTarget, add, update, remove }}>
      {children}
    </AnnotationContext.Provider>
  );
}

export function useAnnotations() {
  const ctx = useContext(AnnotationContext);
  if (!ctx) throw new Error('useAnnotations must be used inside AnnotationProvider');
  return ctx;
}
