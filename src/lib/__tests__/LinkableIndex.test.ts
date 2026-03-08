/**
 * Unit tests for LinkableIndex — normalizeToken, buildLinkableIndex, scanText.
 * Run with: npm run test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  normalizeToken,
  buildLinkableIndex,
  scanText,
} from '../LinkableIndex';
import type { AppData, Entity, AlchemyConcept, Topic } from '../../types';

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<Entity> & { id: string; label: string }): Entity {
  return {
    type: 'thinker',
    aliases: [],
    blurb: '',
    tags: [],
    links: [],
    connections: [],
    sources: [],
    ...overrides,
  };
}

function makeAlchemyConcept(
  overrides: Partial<AlchemyConcept> & { id: string; term: string },
): AlchemyConcept {
  return {
    category: 'general',
    definition: '',
    body: '',
    ...overrides,
  };
}

function makeTopic(
  overrides: Partial<Topic> & { rank: number; name: string },
): Topic {
  return {
    meta: '',
    what_it_is: '',
    what_studied: '',
    connections: [],
    open_questions: '',
    ...overrides,
  };
}

/** Build a minimal AppData fixture. */
function makeData(
  entities: Entity[] = [],
  alchemyConcepts: AlchemyConcept[] = [],
  topics: Topic[] = [],
): AppData {
  return {
    lessons: [],
    entities,
    edges: [],
    timelines: [],
    tables: [],
    artifacts: [],
    conversations: [],
    alchemyConcepts,
    topics,
    entityDetails: {},
    arguments: [],
  };
}

// ─── normalizeToken ────────────────────────────────────────────────────────

describe('normalizeToken', () => {
  it('lowercases ASCII', () => {
    expect(normalizeToken('Ficino')).toBe('ficino');
  });

  it('applies NFKC normalization', () => {
    // fi ligature (U+FB01) → 'fi'
    expect(normalizeToken('\uFB01cino')).toBe('ficino');
  });

  it('strips curly quotes', () => {
    expect(normalizeToken('\u2018quoted\u2019')).toBe('quoted');
    expect(normalizeToken('\u201cQuoted\u201d')).toBe('quoted');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeToken('  Hermes   Trismegistus  ')).toBe('hermes trismegistus');
  });

  it('preserves hyphens (for al-Buni style names)', () => {
    expect(normalizeToken('al-Buni')).toBe('al-buni');
  });

  it('handles empty string', () => {
    expect(normalizeToken('')).toBe('');
  });
});

// ─── buildLinkableIndex ────────────────────────────────────────────────────

describe('buildLinkableIndex', () => {
  it('indexes entity labels', () => {
    const data = makeData([makeEntity({ id: 'e1', label: 'Marsilio Ficino' })]);
    const idx = buildLinkableIndex(data);
    expect(idx.termMap.has('marsilio ficino')).toBe(true);
    const targets = idx.termMap.get('marsilio ficino')!;
    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe('e1');
    expect(targets[0].type).toBe('entity');
  });

  it('indexes entity aliases', () => {
    const data = makeData([
      makeEntity({ id: 'e1', label: 'Marsilio Ficino', aliases: ['Ficino'] }),
    ]);
    const idx = buildLinkableIndex(data);
    expect(idx.termMap.has('ficino')).toBe(true);
    expect(idx.termMap.get('ficino')![0].id).toBe('e1');
  });

  it('does not index terms shorter than 4 chars', () => {
    const data = makeData([makeEntity({ id: 'e1', label: 'One', aliases: ['one', 'al'] })]);
    const idx = buildLinkableIndex(data);
    // 'one' = 3 chars, 'al' = 2 chars — both below minimum
    expect(idx.termMap.has('one')).toBe(false);
    expect(idx.termMap.has('al')).toBe(false);
  });

  it('does not index single-word STOPLIST entries', () => {
    // 'soul', 'mind', 'form' are on the STOPLIST
    const data = makeData([makeEntity({ id: 'e1', label: 'Soul', aliases: ['mind', 'form'] })]);
    const idx = buildLinkableIndex(data);
    expect(idx.termMap.has('soul')).toBe(false);
    expect(idx.termMap.has('mind')).toBe(false);
    expect(idx.termMap.has('form')).toBe(false);
  });

  it('DOES index multi-word phrases even when words are in STOPLIST', () => {
    // "The One" contains "one" (stoplist) but the phrase itself should be indexed
    const data = makeData([makeEntity({ id: 'e1', label: 'The One' })]);
    const idx = buildLinkableIndex(data);
    expect(idx.termMap.has('the one')).toBe(true);
  });

  it('skips entities with linkable === false', () => {
    const data = makeData([
      // Cast to any to inject the optional field not yet in strict EntitySchema runtime type
      { ...makeEntity({ id: 'e1', label: 'Plotinus' }), linkable: false } as Entity,
    ]);
    const idx = buildLinkableIndex(data);
    expect(idx.termMap.has('plotinus')).toBe(false);
  });

  it('indexes alchemy concepts by term', () => {
    const data = makeData(
      [],
      [makeAlchemyConcept({ id: 'ac1', term: 'Philosophical Mercury' })],
    );
    const idx = buildLinkableIndex(data);
    expect(idx.termMap.has('philosophical mercury')).toBe(true);
    expect(idx.termMap.get('philosophical mercury')![0].type).toBe('alchemy');
  });

  it('indexes topics by name', () => {
    const data = makeData([], [], [makeTopic({ rank: 1, name: 'Neoplatonism' })]);
    const idx = buildLinkableIndex(data);
    expect(idx.termMap.has('neoplatonism')).toBe(true);
    expect(idx.termMap.get('neoplatonism')![0].type).toBe('topic');
  });

  it('sortedTerms are sorted longest-first', () => {
    const data = makeData([
      makeEntity({ id: 'e1', label: 'Ficino' }),
      makeEntity({ id: 'e2', label: 'Marsilio Ficino' }),
    ]);
    const idx = buildLinkableIndex(data);
    const fiIndex = idx.sortedTerms.indexOf('ficino');
    const fullIndex = idx.sortedTerms.indexOf('marsilio ficino');
    // Longer term must come first
    expect(fullIndex).toBeLessThan(fiIndex);
  });

  it('deduplicates targets for the same normalized term', () => {
    const data = makeData([
      makeEntity({ id: 'e1', label: 'Ficino', aliases: ['Ficino'] }), // duplicate
    ]);
    const idx = buildLinkableIndex(data);
    expect(idx.termMap.get('ficino')).toHaveLength(1);
  });

  it('records disambiguation targets when two entities share a label', () => {
    const data = makeData([
      makeEntity({ id: 'e1', label: 'Mercury', type: 'concept' }),
      makeEntity({ id: 'e2', label: 'Mercury', type: 'term' }),
    ]);
    const idx = buildLinkableIndex(data);
    const targets = idx.termMap.get('mercury') ?? [];
    expect(targets).toHaveLength(2);
  });
});

// ─── scanText ──────────────────────────────────────────────────────────────

describe('scanText', () => {
  let idx: ReturnType<typeof buildLinkableIndex>;

  beforeAll(() => {
    const data = makeData(
      [
        makeEntity({ id: 'e_ficino', label: 'Marsilio Ficino', aliases: ['Ficino'] }),
        makeEntity({ id: 'e_pico', label: 'Pico della Mirandola', aliases: ['Pico'] }),
        makeEntity({ id: 'e_plotinus', label: 'Plotinus' }),
      ],
      [makeAlchemyConcept({ id: 'ac_mercury', term: 'Philosophical Mercury' })],
      [makeTopic({ rank: 1, name: 'Neoplatonism' })],
    );
    idx = buildLinkableIndex(data);
  });

  it('finds a single entity label', () => {
    const matches = scanText('The writings of Plotinus shaped late antiquity.', idx);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('Plotinus');
    expect(matches[0].targets[0].id).toBe('e_plotinus');
  });

  it('prefers longest match (Marsilio Ficino > Ficino)', () => {
    const matches = scanText('Marsilio Ficino wrote the Platonic Theology.', idx);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('Marsilio Ficino');
    expect(matches[0].targets[0].id).toBe('e_ficino');
  });

  it('matches alias when full name absent', () => {
    const matches = scanText('Ficino translated the Enneads.', idx);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('Ficino');
  });

  it('matches multiple entities in one text', () => {
    const matches = scanText('Both Ficino and Pico were Florentine.', idx);
    expect(matches).toHaveLength(2);
    const texts = matches.map(m => m.text);
    expect(texts).toContain('Ficino');
    expect(texts).toContain('Pico');
  });

  it('enforces word boundaries — does not match inside longer word', () => {
    // "Neoplatonism" should match; "Neoplatonists" should NOT match "Neoplatonism" mid-word
    const text = 'Neoplatonists inherited from Neoplatonism.';
    const matches = scanText(text, idx);
    // Only the standalone "Neoplatonism" should match
    expect(matches.filter(m => m.text === 'Neoplatonism')).toHaveLength(1);
    // "Neoplatonists" must not be matched (no word boundary after 's')
    expect(matches.filter(m => m.start === text.indexOf('Neoplatonists'))).toHaveLength(0);
  });

  it('excludes inline code spans from linkification', () => {
    const matches = scanText('Use `Ficino` for the variable name.', idx);
    expect(matches).toHaveLength(0);
  });

  it('excludes URLs from linkification', () => {
    const matches = scanText('See https://example.com/Ficino for details.', idx);
    expect(matches).toHaveLength(0);
  });

  it('respects maxChars — does not match beyond the limit', () => {
    const prefix = 'Plotinus wrote much. '.repeat(50); // > 2000 chars
    const text = prefix + 'Ficino came later.';
    const withinCap = scanText(text, idx, 50);
    // "Ficino" is beyond char 50
    expect(withinCap.every(m => m.end <= 50)).toBe(true);
    expect(withinCap.some(m => m.text === 'Ficino')).toBe(false);
  });

  it('returns empty array for empty text', () => {
    expect(scanText('', idx)).toEqual([]);
  });

  it('returns empty array when index has no terms', () => {
    const emptyIdx = buildLinkableIndex(makeData());
    expect(scanText('Plotinus was important.', emptyIdx)).toEqual([]);
  });

  it('match positions are correct', () => {
    const text = 'The work of Ficino was central.';
    const matches = scanText(text, idx);
    expect(matches).toHaveLength(1);
    expect(matches[0].start).toBe(text.indexOf('Ficino'));
    expect(matches[0].end).toBe(text.indexOf('Ficino') + 'Ficino'.length);
  });

  it('matches multi-word alchemy terms', () => {
    const matches = scanText('The Philosophical Mercury is key.', idx);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('Philosophical Mercury');
    expect(matches[0].targets[0].type).toBe('alchemy');
  });

  it('case-insensitive matching', () => {
    const matches = scanText('plotinus shaped neoplatonism.', idx);
    const texts = matches.map(m => m.text);
    expect(texts).toContain('plotinus');
    expect(texts).toContain('neoplatonism');
  });
});
