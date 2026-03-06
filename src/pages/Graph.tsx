import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow as ReactFlowBase,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge as RFEdge, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
const ReactFlow = ReactFlowBase as unknown as React.ComponentType<any>;
import { useApp } from '../contexts/AppContext';
import { useTrail } from '../contexts/TrailContext';
import type { Entity, EntityType } from '../types';

// ─── Node type colors ─────────────────────────────────────────────────────
const TYPE_CONFIG: Record<EntityType, { color: string; bg: string }> = {
  thinker:  { color: '#a86830', bg: '#fdf0dc' },
  text:     { color: '#1e40af', bg: '#eff6ff' },
  concept:  { color: '#7c3aed', bg: '#f5f3ff' },
  tool:     { color: '#15803d', bg: '#f0fdf4' },
  term:     { color: '#991b1b', bg: '#fef2f2' },
};
const LESSON_CONFIG = { color: '#374151', bg: '#f9fafb' };

// Lens types
type Lens = 'all' | 'influence' | 'concepts' | 'conversation';

const LENS_LABELS: Record<Lens, string> = {
  all:          'All',
  influence:    'Influence',
  concepts:     'Concepts',
  conversation: 'Co-occurrence',
};

// ─── Compute layout: radial by type ──────────────────────────────────────────────────
function computePositions(
  entities: Entity[],
  lessonIds: string[]
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  lessonIds.forEach((id, i) => {
    positions[id] = { x: 150 + i * 220, y: 60 };
  });

  const byType: Partial<Record<EntityType, Entity[]>> = {};
  entities.forEach(e => {
    if (!byType[e.type]) byType[e.type] = [];
    byType[e.type]!.push(e);
  });

  const typePositions: Record<EntityType, { cx: number; cy: number }> = {
    thinker:  { cx: 200,  cy: 300 },
    text:     { cx: 600,  cy: 300 },
    concept:  { cx: 400,  cy: 520 },
    tool:     { cx: 700,  cy: 520 },
    term:     { cx: 100,  cy: 520 },
  };

  Object.entries(byType).forEach(([type, items]) => {
    const { cx, cy } = typePositions[type as EntityType];
    const total = items!.length;
    items!.forEach((e, i) => {
      const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
      const r = total > 1 ? 80 : 0;
      positions[e.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
  });

  return positions;
}

// ─── N-hop neighborhood ──────────────────────────────────────────────────────────
function getNHopNeighbors(
  rootId: string,
  hops: number,
  allEdges: Array<{ source: string; target: string }>
): Set<string> {
  const visited = new Set<string>([rootId]);
  let frontier = new Set<string>([rootId]);

  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const edge of allEdges) {
      if (frontier.has(edge.source) && !visited.has(edge.target)) {
        next.add(edge.target);
        visited.add(edge.target);
      }
      if (frontier.has(edge.target) && !visited.has(edge.source)) {
        next.add(edge.source);
        visited.add(edge.source);
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }

  return visited;
}

// ─── Custom node component ────────────────────────────────────────────────────
function EntityNode({ data }: { data: Record<string, unknown> }) {
  const type = data.entityType as EntityType | 'lesson';
  const cfg = type === 'lesson' ? LESSON_CONFIG : (TYPE_CONFIG[type as EntityType] ?? TYPE_CONFIG.concept);

  return (
    <div
      className="px-3 py-2 cursor-pointer"
      style={
        {
          background: 'var(--bg-surface)',
          border: `2px solid ${cfg.color}`,
          borderRadius: 'var(--radius)',
          minWidth: '120px',
          maxWidth: '160px',
          textAlign: 'center',
        }
      }
    >
      <div
        className="text-xs font-medium uppercase tracking-wide mb-0.5"
        style={{ color: cfg.color, fontFamily: 'var(--font-mono)' }}
      >
        {type}
      </div>
      <div
        className="text-sm font-semibold leading-snug"
        style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}
      >
        {data.label as string}
      </div>
    </div>
  );
}

const nodeTypes = { entity: EntityNode };

// ─── Main page ────────────────────────────────────────────────────────────────
export function Graph() {
  const { data, loading, openEntityDrawer } = useApp();
  const { addEntry } = useTrail();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [_highlightedNode, setHighlightedNode] = useState<string | null>(
    searchParams.get('node')
  );
  const [typeFilter, setTypeFilter] = useState<Set<EntityType>>(new Set());
  const [lens, setLens] = useState<Lens>('all');

  const focusedNodeId = searchParams.get('node');
  const hops = Math.min(3, Math.max(1, parseInt(searchParams.get('hops') ?? '1', 10)));

  useEffect(() => { addEntry('/graph', 'Knowledge Graph'); }, []);

  // Build co-occurrence edges from entity_details (for conversation lens)
  const coOccurrenceEdges = useMemo(() => {
    if (!data) return [];
    const edges: Array<{ source: string; target: string; weight: number }> = [];
    const seen = new Set<string>();
    for (const [entityId, detail] of Object.entries(data.entityDetails)) {
      for (const co of detail.co_entities.slice(0, 5)) {
        const key = [entityId, co.id].sort().join('--');
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ source: entityId, target: co.id, weight: co.shared });
        }
      }
    }
    return edges;
  }, [data]);

  const { rfNodes, rfEdges } = useMemo(() => {
    if (!data) return { rfNodes: [], rfEdges: [] };

    // Determine which edges to show based on lens
    let edgePool = data.edges;
    if (lens === 'influence') edgePool = data.edges.filter(e => e.type === 'derived-from');
    if (lens === 'concepts') edgePool = data.edges.filter(e =>
      data.entities.find(en => en.id === e.source)?.type === 'concept' ||
      data.entities.find(en => en.id === e.target)?.type === 'concept'
    );

    const useCoOccurrence = lens === 'conversation';
    const edgesForNeighborhood = useCoOccurrence
      ? coOccurrenceEdges.map(e => ({ source: e.source, target: e.target }))
      : edgePool.map(e => ({ source: e.source, target: e.target }));

    // Apply focus / N-hop filter
    let allowedIds: Set<string> | null = null;
    if (focusedNodeId) {
      allowedIds = getNHopNeighbors(focusedNodeId, hops, edgesForNeighborhood);
    }

    // Filter entities
    let allEntities = data.entities.filter(e =>
      (typeFilter.size === 0 || typeFilter.has(e.type)) &&
      (lens !== 'concepts' || e.type === 'concept') &&
      (allowedIds == null || allowedIds.has(e.id))
    );

    const lessonIds = focusedNodeId ? [] : data.lessons.map(l => l.id);
    const positions = computePositions(allEntities, lessonIds);

    const rfNodes: Node[] = [
      ...lessonIds.map(lid => {
        const l = data.lessons.find(x => x.id === lid)!;
        return {
          id: l.id,
          type: 'entity',
          position: positions[l.id] ?? { x: 0, y: 0 },
          data: { label: l.title, entityType: 'lesson' },
        };
      }),
      ...allEntities.map(e => ({
        id: e.id,
        type: 'entity',
        position: positions[e.id] ?? { x: 0, y: 0 },
        data: { label: e.label, entityType: e.type, entity: e },
        selected: e.id === focusedNodeId,
      })),
    ];

    const visibleIds = new Set(rfNodes.map(n => n.id));

    let rfEdges: RFEdge[];
    if (useCoOccurrence) {
      rfEdges = coOccurrenceEdges
        .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
        .map((e, i) => ({
          id: `co_${i}`,
          source: e.source,
          target: e.target,
          label: `${e.weight}×`,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border-strong)' },
          style: { stroke: 'var(--border-strong)', strokeWidth: Math.max(1, Math.min(4, e.weight / 10)) },
          labelStyle: { fill: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' },
          labelBgStyle: { fill: 'var(--bg-surface)' },
        }));
    } else {
      rfEdges = edgePool
        .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
        .map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.type,
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border-strong)' },
          style: { stroke: 'var(--border-strong)', strokeWidth: Math.max(1, e.weight) },
          labelStyle: { fill: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' },
          labelBgStyle: { fill: 'var(--bg-surface)' },
        }));
    }

    return { rfNodes, rfEdges };
  }, [data, typeFilter, lens, focusedNodeId, hops, coOccurrenceEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const entity = data?.entities.find(e => e.id === node.id);
      if (entity) {
        openEntityDrawer(entity);
        setSearchParams({ node: entity.id, hops: String(hops) });
        setHighlightedNode(entity.id);
      }
    },
    [data, openEntityDrawer, setSearchParams, hops]
  );

  const toggleType = (t: EntityType) => {
    setTypeFilter(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const entityTypes: EntityType[] = ['thinker', 'text', 'concept', 'tool', 'term'];

  if (loading) return <div className="p-8" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-5 py-3 shrink-0 flex-wrap"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}>
          Knowledge Graph
        </span>

        {/* Lens selector */}
        <div className="flex items-center gap-1 border rounded-md overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {(['all', 'influence', 'concepts', 'conversation'] as Lens[]).map(l => (
            <button
              key={l}
              onClick={() => setLens(l)}
              className="px-2.5 py-1 text-xs transition-colors"
              style={
                {
                  background: lens === l ? 'var(--primary)' : 'transparent',
                  color: lens === l ? 'var(--primary-text)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }
              }
            >
              {LENS_LABELS[l]}
            </button>
          ))}
        </div>

        {/* Type filter (hidden in concepts lens) */}
        {lens !== 'concepts' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Filter:</span>
            {entityTypes.map(t => {
              const cfg = TYPE_CONFIG[t];
              const active = typeFilter.size === 0 || typeFilter.has(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className="text-xs px-2 py-1 transition-colors"
                  style={
                    {
                      background: active ? cfg.bg : 'var(--bg-surface)',
                      color: active ? cfg.color : 'var(--text-muted)',
                      border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      opacity: active ? 1 : 0.5,
                    }
                  }
                >
                  {t}
                </button>
              );
            })}
            {typeFilter.size > 0 && (
              <button
                onClick={() => setTypeFilter(new Set())}
                className="text-xs px-2"
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                × All
              </button>
            )}
          </div>
        )}

        {/* Focus controls */}
        {focusedNodeId && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Hops:</span>
            {[1, 2, 3].map(h => (
              <button
                key={h}
                onClick={() => setSearchParams({ node: focusedNodeId, hops: String(h) })}
                className="w-6 h-6 text-xs rounded transition-colors"
                style={
                  {
                    background: hops === h ? 'var(--primary)' : 'var(--bg-card)',
                    color: hops === h ? 'var(--primary-text)' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }
                }
              >
                {h}
              </button>
            ))}
            <button
              onClick={() => { setSearchParams({}); setHighlightedNode(null); }}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Full graph
            </button>
            <button
              onClick={() => navigate(`/entities/${focusedNodeId}`)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ background: 'var(--primary)', color: 'var(--primary-text)', border: 'none' }}
            >
              View page →
            </button>
          </div>
        )}

        {!focusedNodeId && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            Click a node to focus
          </span>
        )}
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative" style={{ background: 'var(--bg)' }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--border)"
          />
          <Controls />
          <MiniMap
            nodeColor={node => {
              const type = node.data?.entityType as string;
              if (type === 'lesson') return LESSON_CONFIG.color;
              return TYPE_CONFIG[type as EntityType]?.color ?? '#888';
            }}
            style={
              {
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }
            }
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-4 px-5 py-2 flex-wrap shrink-0"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Legend:</span>
        {entityTypes.map(t => (
          <div key={t} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ background: TYPE_CONFIG[t].bg, border: `2px solid ${TYPE_CONFIG[t].color}` }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {t}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ background: LESSON_CONFIG.bg, border: `2px solid ${LESSON_CONFIG.color}` }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            lesson
          </span>
        </div>
      </div>
    </div>
  );
}
