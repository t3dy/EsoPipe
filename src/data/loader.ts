import { z } from 'zod';
import {
  LessonSchema,
  EntitySchema,
  EdgeSchema,
  TimelineSchema,
  type AppData,
  type ValidationError,
} from '../types';

function parseArray<T>(
  raw: unknown[],
  schema: z.ZodSchema<T>,
  fileName: string,
  errors: ValidationError[]
): T[] {
  const results: T[] = [];
  raw.forEach((item, i) => {
    const parsed = schema.safeParse(item);
    if (parsed.success) {
      results.push(parsed.data);
    } else {
      const id = typeof item === 'object' && item !== null && 'id' in item
        ? String((item as Record<string, unknown>).id)
        : undefined;
      errors.push({
        file: fileName,
        index: i,
        id,
        message: parsed.error.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`).join('; '),
      });
    }
  });
  return results;
}

export interface LoadResult {
  data: AppData;
  errors: ValidationError[];
}

export async function loadAppData(): Promise<LoadResult> {
  const errors: ValidationError[] = [];

  const base = import.meta.env.BASE_URL;

  const [lessonsRaw, entitiesRaw, edgesRaw, timelinesRaw] = await Promise.all([
    fetch(`${base}data/lessons.json`).then(r => r.json()),
    fetch(`${base}data/entities.json`).then(r => r.json()),
    fetch(`${base}data/edges.json`).then(r => r.json()),
    fetch(`${base}data/timelines.json`).then(r => r.json()),
  ]);

  const lessons = parseArray(lessonsRaw, LessonSchema, 'lessons.json', errors);
  const entities = parseArray(entitiesRaw, EntitySchema, 'entities.json', errors);
  const edges = parseArray(edgesRaw, EdgeSchema, 'edges.json', errors);
  const timelines = parseArray(timelinesRaw, TimelineSchema, 'timelines.json', errors);

  return { data: { lessons, entities, edges, timelines }, errors };
}
