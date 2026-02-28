import React, { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
// @xyflow/react v12 exports are ESM named exports only (no default)
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
// Cast to any to work around @xyflow/react's generic Node<T> not matching JSX constraints
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactFlow = ReactFlowBase as unknown as React.ComponentType<any>;
import { useApp } from '../contexts/AppContext';
import type { Entity, EntityType } from '../types';

// ─── Node type colors ─────────────────────────────────────────────────────
const TYPE_CONFIG: Record<EntityType, { color: string; bg: string }> = {
  thinker:  { color: '#a86830', bg: '#fdf0dc' },
  text:     { color: '#1e40af', bg: '#eff6ff' },
  concept:  { color: '#7c3aed', bg: '#f5f3ff' },
  tool:     { color: '#15803d', bg: '#f0fdf4' },
  term:     { color: '#991b1b', bg: '#fef2f2' },
};

// Lesson node style
const LESSON_CONFIG = { color: '#374151', bg: '#f9fafb' };

// ─── Compute layout: radial by type ──────────────────────────────────────
function computePositions(
  entities: Entity[],
  lessonIds: string[]
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  // Lessons in a row at top
  lessonIds.forEach((id, i) => {
    positions[id] = { x: 150 + i * 220, y: 60 };
  });

  // Group entities by type
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

// ─── Custom node component ────────────────────────────────────────────────
function EntityNode({ data }: { data: Record<string, unknown> }) {
  const type = data.entityType as EntityType | 'lesson';
  const cfg = type === 'lesson' ? LESSON_CONFIG : (TYPE_CONFIG[type as EntityType] ?? TYPE_CONFIG.concept);

  return (
    <div
      className="px-3 py-2 cursor-pointer"
      style={{
        background: 'var(--bg-surface)',
        border: `2px solid ${cfg.color}`,
        borderRadius: 'var(--radius)',
        minWidth: '120px',
        maxWidth: '160px',
        textAlign: 'center',
      }}
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

// ─── Main page ────────────────────────────────────────────────────────────
export function Graph() {
  const { data, loading, openEntityDrawer } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [_highlightedNode, setHighlightedNode] = useState<string | null>(
    searchParams.get('node')
  );
  const [typeFilter, setTypeFilter] = useState<Set<EntityType>>(new Set());

  const focusedNodeId = searchParams.get('node');

  // Build React Flow nodes and edges from data
  const { rfNodes, rfEdges } = (() => {
    if (!data) return { rfNodes: [], rfEdges: [] };

    const allEntities = data.entities.filter(e =>
      typeFilter.size === 0 || typeFilter.has(e.type)
    );
    const lessonIds = data.lessons.map(l => l.id);

    const positions = computePositions(allEntities, lessonIds);

    const rfNodes: Node[] = [
      // Lesson nodes
      ...data.lessons.map(l => ({
        id: l.id,
        type: 'entity',
        position: positions[l.id] ?? { x: 0, y: 0 },
        data: { label: l.title, entityType: 'lesson' },
      })),
      // Entity nodes
      ...allEntities.map(e => ({
        id: e.id,
        type: 'entity',
        position: positions[e.id] ?? { x: 0, y: 0 },
        data: { label: e.label, entityType: e.type, entity: e },
        selected: e.id === focusedNodeId,
      })),
    ];

    const visibleIds = new Set(rfNodes.map(n => n.id));
    const rfEdges: RFEdge[] = data.edges
      .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.type,
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border-strong)' },
        style: { stroke: 'var(--border-strong)', strokeWidth: Math.max(1, e.weight) },
        labelStyle: {
          fill: 'var(--text-muted)',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
        },
        labelBgStyle: { fill: 'var(--bg-surface)' },
      }));

    return { rfNodes, rfEdges };
  })();

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      const entity = data?.entities.find(e => e.id === node.id);
      if (entity) {
        openEntityDrawer(entity);
        setSearchParams({ node: entity.id });
        setHighlightedNode(entity.id);
      }
    },
    [data, openEntityDrawer, setSearchParams]
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
        className="flex items-center gap-4 px-5 py-3 shrink-0 flex-wrap"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}>
          Knowledge Graph
        </span>
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
                style={{
                  background: active ? cfg.bg : 'var(--bg-surface)',
                  color: active ? cfg.color : 'var(--text-muted)',
                  border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  opacity: active ? 1 : 0.5,
                }}
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
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          Click a node to see details
        </span>
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
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
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
