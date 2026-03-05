import { z } from 'zod';

// ─── Entity ────────────────────────────────────────────────────────────────

export const EntityTypeSchema = z.enum(['thinker', 'text', 'term', 'tool', 'concept']);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const EntitySchema = z.object({
  id: z.string(),
  type: EntityTypeSchema,
  label: z.string(),
  aliases: z.array(z.string()).default([]),
  blurb: z.string().default(''),
  tags: z.array(z.string()).default([]),
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
});
export type Entity = z.infer<typeof EntitySchema>;

// ─── Edge ──────────────────────────────────────────────────────────────────

export const EdgeTypeSchema = z.enum(['uses', 'explains', 'compares', 'derived-from', 'mentions']);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: EdgeTypeSchema,
  weight: z.number().default(1),
  notes: z.string().default(''),
});
export type Edge = z.infer<typeof EdgeSchema>;

// ─── Timeline Event ────────────────────────────────────────────────────────

export const CitationSchema = z.object({
  source_id: z.string().optional(),
  page: z.string().optional(),
  note: z.string().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const TimelineEventSchema = z.object({
  id: z.string(),
  timeline_id: z.string(),
  start: z.string(),
  end: z.string().nullable().default(null),
  title: z.string(),
  tags: z.array(z.string()).default([]),
  related_entities: z.array(z.string()).default([]),
  description_md: z.string().default(''),
  citations: z.array(CitationSchema).default([]),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const TimelineSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  events: z.array(TimelineEventSchema),
});
export type Timeline = z.infer<typeof TimelineSchema>;

// ─── Lesson ────────────────────────────────────────────────────────────────

export const DifficultySchema = z.enum(['intro', 'intermediate', 'advanced']);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const CsConceptSchema = z.object({
  name: z.string(),
  notes: z.string().default(''),
});
export type CsConcept = z.infer<typeof CsConceptSchema>;

export const ScholarlyApplicationSchema = z.object({
  domain: z.string(),
  notes: z.string().default(''),
});
export type ScholarlyApplication = z.infer<typeof ScholarlyApplicationSchema>;

export const SectionSchema = z.object({
  heading: z.string(),
  content_md: z.string(),
});
export type Section = z.infer<typeof SectionSchema>;

export const CodeSnippetSchema = z.object({
  lang: z.string(),
  title: z.string(),
  code: z.string(),
});
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;

export const ExerciseSchema = z.object({
  prompt: z.string(),
  solution_md: z.string().default(''),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().default(''),
  difficulty: DifficultySchema,
  estimated_time: z.string().default(''),
  tags: z.array(z.string()).default([]),
  cs_concepts: z.array(CsConceptSchema).default([]),
  scholarly_application: ScholarlyApplicationSchema.optional(),
  sections: z.array(SectionSchema).default([]),
  code_snippets: z.array(CodeSnippetSchema).default([]),
  exercises: z.array(ExerciseSchema).default([]),
  related_entities: z.array(z.string()).default([]),
});
export type Lesson = z.infer<typeof LessonSchema>;

// ─── Scholarly Table ───────────────────────────────────────────────────────

/**
 * Column types map to visual styling in the table renderer:
 *   concept       – neutral/bold header cell
 *   tradition     – coloured by tradition (muted blue)
 *   contributions – warm amber (positive)
 *   challenges    – warm rose (tension)
 *   quotation     – italic, muted, smaller font
 *   takeaway      – researcher-voice: slightly highlighted
 *   lacunae       – dim/faded (absence / unknown)
 *   figure        – bold name + bio
 *   works         – bibliographic list
 *   methodology   – process-oriented
 *   content       – neutral summary
 *   context       – historical framing
 */
export const ColTypeSchema = z.enum([
  'concept', 'tradition', 'contributions', 'challenges',
  'quotation', 'takeaway', 'lacunae', 'figure', 'works',
  'methodology', 'content', 'context', 'notes',
]);
export type ColType = z.infer<typeof ColTypeSchema>;

export const TableTemplateSchema = z.enum([
  'philosophical-comparison',
  'scholar-profile',
  'inventory',
  'evidence-audit',
  'article-decomposition',
]);
export type TableTemplate = z.infer<typeof TableTemplateSchema>;

export const TableColumnSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: ColTypeSchema,
  width: z.string().default('auto'),   // css % or 'auto'
});
export type TableColumn = z.infer<typeof TableColumnSchema>;

export const ScholarlyTableSchema = z.object({
  id: z.string(),
  template: TableTemplateSchema,
  title: z.string(),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  columns: z.array(TableColumnSchema),
  rows: z.array(z.record(z.string(), z.string())),
});
export type ScholarlyTable = z.infer<typeof ScholarlyTableSchema>;

// ─── Artifacts \u0026 Provenance ───────────────────────────────────────────────

export const ArtifactSourceSchema = z.object({
  source_type: z.enum(['turn', 'table', 'entity', 'pdf_chunk']),
  source_id: z.string(),
  weight: z.number().default(1.0),
});
export type ArtifactSource = z.infer<typeof ArtifactSourceSchema>;

export const WhosWhoPayloadSchema = z.object({
  title: z.string(),
  summary: z.string(),
  key_contributions: z.array(z.string()).optional(),
  core_texts: z.array(z.string()).optional(),
});

export const PamphletPayloadSchema = z.object({
  title: z.string(),
  author: z.string().default('EsoPipe 2.0'),
  panels: z.array(z.object({
    heading: z.string(),
    content: z.string(),
  })).length(3).optional(),
});

export const AuditPayloadSchema = z.object({
  claim: z.string(),
  verdict: z.enum(['verified', 'refuted', 'ambiguous', 'unsupported']),
  evidence_summary: z.string(),
});

export const ArtifactSchema = z.object({
  id: z.string(),
  type: z.enum(['whois', 'pamphlet', 'audit', 'video']),
  schema_version: z.string(),
  payload: z.union([WhosWhoPayloadSchema, PamphletPayloadSchema, AuditPayloadSchema, z.any()]),
  payload_markdown: z.string().nullable().optional(),
  context_snapshot: z.any().optional(),
  revision_number: z.number().default(1),
  created_at: z.string(),
  sources: z.array(ArtifactSourceSchema).default([]),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

// ─── App Data ──────────────────────────────────────────────────────────────

export interface AppData {
  lessons: Lesson[];
  entities: Entity[];
  edges: Edge[];
  timelines: Timeline[];
  tables: ScholarlyTable[];
  artifacts: Artifact[];
  conversations: ConversationMeta[];
  alchemyConcepts: AlchemyConcept[];
  topics: Topic[];
  entityDetails: EntityDetailsMap;
}

export interface ValidationError {
  file: string;
  index: number;
  id?: string;
  message: string;
}

// ─── Search ────────────────────────────────────────────────────────────────

export type SearchResultType = 'lesson' | 'entity' | 'timeline_event';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  summary: string;
  tags: string[];
  href: string;
}

// ─── Conversations ─────────────────────────────────────────────────────────

export interface ConversationMeta {
  id: number;
  title: string;
  date: string;
  model: string;
  turn_count: number;
  word_count: number;
  entity_ids: string[];
  request_types: string[];
}

export interface ConvTurn {
  id: number;
  turn_index: number;
  role: 'user' | 'assistant';
  content: string;
  word_count: number;
  request_types: string[];
}

export interface ConversationDetail {
  id: number;
  title: string;
  date: string;
  turns: ConvTurn[];
}

// ─── Alchemy Concepts ──────────────────────────────────────────────────────

export interface AlchemyConcept {
  id: string;
  term: string;
  category: string;
  definition: string;
  body: string;
}

// ─── Topics ────────────────────────────────────────────────────────────────

export interface Topic {
  rank: number;
  name: string;
  meta: string;
  what_it_is: string;
  what_studied: string;
  connections: string[];
  open_questions: string;
}

// ─── Entity Details ────────────────────────────────────────────────────────

export interface EntityDetail {
  conversation_ids: number[];
  mention_count: number;
  co_entities: { id: string; shared: number }[];
}

export type EntityDetailsMap = Record<string, EntityDetail>;

// ─── Theme ─────────────────────────────────────────────────────────────────

export type ThemeKey = 'parchment' | 'dark-academia' | 'journal' | 'mac80s';

export interface ThemeOption {
  key: ThemeKey;
  label: string;
  description: string;
}
