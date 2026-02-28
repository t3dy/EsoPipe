import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from 'react';
import MiniSearch from 'minisearch';
import { loadAppData } from '../data/loader';
import type { AppData, ValidationError, SearchResult, Entity } from '../types';

interface AppCtx {
  data: AppData | null;
  errors: ValidationError[];
  loading: boolean;
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

  useEffect(() => {
    loadAppData().then(({ data: d, errors: e }) => {
      setData(d);
      setErrors(e);
      setLoading(false);

      // Build search index
      const ms = new MiniSearch({
        fields: ['label', 'summary', 'tags_str'],
        storeFields: ['label', 'summary', 'tags', 'type', 'href'],
        searchOptions: { prefix: true, fuzzy: 0.2 },
      });

      const docs: Array<Record<string, unknown>> = [];

      d.lessons.forEach(l => docs.push({
        id: l.id,
        label: l.title,
        summary: l.summary,
        tags: l.tags,
        tags_str: l.tags.join(' '),
        type: 'lesson',
        href: `/lessons/${l.id}`,
      }));

      d.entities.forEach(en => docs.push({
        id: en.id,
        label: en.label,
        summary: en.blurb,
        tags: en.tags,
        tags_str: en.tags.join(' '),
        type: 'entity',
        href: `/graph?node=${en.id}`,
      }));

      d.timelines.forEach(tl =>
        tl.events.forEach(ev => docs.push({
          id: ev.id,
          label: ev.title,
          summary: ev.description_md.replace(/[#*`]/g, '').slice(0, 120),
          tags: ev.tags,
          tags_str: ev.tags.join(' '),
          type: 'timeline_event',
          href: `/timelines?timeline=${tl.id}&event=${ev.id}`,
        }))
      );

      ms.addAll(docs);
      setMiniSearch(ms);
    });
  }, []);

  const search = useCallback(
    (query: string): SearchResult[] => {
      if (!miniSearch || !query.trim()) return [];
      return miniSearch.search(query).slice(0, 12).map(r => ({
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
      data, errors, loading, search,
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
