import {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
  type ReactNode,
} from 'react';
import MiniSearch from 'minisearch';
import { loadAppData } from '../data/loader';
import { buildLinkableIndex } from '../lib/LinkableIndex';
import type {
  AppData, ValidationError, SearchResult, Entity, LinkableIndex,
} from '../types';

interface AppCtx {
  data: AppData | null;
  errors: ValidationError[];
  loading: boolean;
  isDesktop: boolean;
  linkableIndex: LinkableIndex | null;
  search: (query: string) => SearchResult[];
  selectedEntity: Entity | null;
  setSelectedEntity: (e: Entity | null) => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  openEntityDrawer: (entity: Entity) => void;
}

const AppContext = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(true);
  const [miniSearch, setMiniSearch] = useState<MiniSearch | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop mode by pinging the FastAPI backend
  useEffect(() => {
    fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(1500) })
      .then(r => { if (r.ok) setIsDesktop(true); })
      .catch(() => { /* static mode — no backend */ });
  }, []);

  useEffect(() => {
    loadAppData().then(({ data: d, errors: e }) => {
      setData(d);
      setErrors(e);
      setLoading(false);

      // ── Extended MiniSearch index ───────────────────────────────────────
      // Covers all searchable content types so SearchPage gets unified results
      const ms = new MiniSearch({
        fields: ['label', 'summary', 'tags_str'],
        storeFields: ['label', 'summary', 'tags', 'type', 'href'],
        searchOptions: { prefix: true, fuzzy: 0.2 },
      });

      const docs: Array<Record<string, unknown>> = [];

      // Lessons
      d.lessons.forEach(l => docs.push({
        id: `lesson_${l.id}`,
        label: l.title,
        summary: l.summary,
        tags: l.tags,
        tags_str: l.tags.join(' '),
        type: 'lesson',
        href: `/lessons/${l.id}`,
      }));

      // Entities
      d.entities.forEach(en => docs.push({
        id: `entity_${en.id}`,
        label: en.label,
        summary: en.blurb,
        tags: en.tags,
        tags_str: en.tags.join(' '),
        type: 'entity',
        href: `/entities/${en.id}`,
      }));

      // Timeline events
      d.timelines.forEach(tl =>
        tl.events.forEach(ev => docs.push({
          id: `tl_${ev.id}`,
          label: ev.title,
          summary: ev.description_md.replace(/[#*`]/g, '').slice(0, 120),
          tags: ev.tags,
          tags_str: ev.tags.join(' '),
          type: 'timeline_event',
          href: `/timelines?timeline=${tl.id}&event=${ev.id}`,
        }))
      );

      // Conversations
      d.conversations.forEach(c => docs.push({
        id: `conv_${c.id}`,
        label: c.title,
        summary: c.entity_ids.slice(0, 8).join(', '),
        tags: c.request_types,
        tags_str: c.request_types.join(' '),
        type: 'conversation',
        href: `/conversations/${c.id}`,
      }));

      // Alchemy concepts
      d.alchemyConcepts.forEach(ac => docs.push({
        id: `alch_${ac.id}`,
        label: ac.term,
        summary: ac.definition.slice(0, 120),
        tags: [ac.category],
        tags_str: ac.category,
        type: 'alchemy',
        href: `/alchemy#${ac.id}`,
      }));

      // Topics
      d.topics.forEach(t => docs.push({
        id: `topic_${t.rank}`,
        label: t.name,
        summary: t.what_it_is ? t.what_it_is.slice(0, 120) : '',
        tags: t.connections.slice(0, 6),
        tags_str: t.connections.join(' '),
        type: 'topic',
        href: `/topics#${t.rank}`,
      }));

      ms.addAll(docs);
      setMiniSearch(ms);
    });
  }, []);

  // ── LinkableIndex ─────────────────────────────────────────────────────────
  const linkableIndex = useMemo<LinkableIndex | null>(
    () => (data ? buildLinkableIndex(data) : null),
    [data]
  );

  const search = useCallback(
    (query: string): SearchResult[] => {
      if (!miniSearch || !query.trim()) return [];
      return miniSearch.search(query).slice(0, 30).map(r => ({
        id: String(r.id),
        type: r.type as SearchResult['type'],
        label: r.label as string,
        summary: (r.summary as string) ?? '',
        tags: (r.tags as string[]) ?? [],
        href: r.href as string,
      }));
    },
    [miniSearch]
  );

  const openEntityDrawer = useCallback((entity: Entity) => {
    setSelectedEntity(entity);
    setDrawerOpen(true);
  }, []);

  return (
    <AppContext.Provider value={{
      data, errors, loading, isDesktop, linkableIndex, search,
      selectedEntity, setSelectedEntity,
      drawerOpen, setDrawerOpen,
      openEntityDrawer,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

// Alias for pages that were scaffolded with this name
export const useAppContext = useApp;
