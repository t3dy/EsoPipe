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

// ─── App Data ──────────────────────────────────────────────────────────────

export interface AppData {
  lessons: Lesson[];
  entities: Entity[];
  edges: Edge[];
  timelines: Timeline[];
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

// ─── Theme ─────────────────────────────────────────────────────────────────

export type ThemeKey = 'parchment' | 'dark-academia' | 'journal' | 'mac80s';

export interface ThemeOption {
  key: ThemeKey;
  label: string;
  description: string;
}
