/**
 * LinkableIndex — build-time vocabulary index for autolinking.
 *
 * Provides:
 *  - buildLinkableIndex(data)  → LinkableIndex
 *  - scanText(text, index)     → TextMatch[]  (greedy longest-match)
 *
 * Safety rules enforced here:
 *  - Minimum term length: 4 characters
 *  - Single-word tokens in STOPLIST are never linked
 *  - Exclusion ranges: inline code (`…`), URLs, file paths
 *  - Word boundaries required at both ends of every match
 */

import type { AppData, LinkableIndex, LinkTarget } from '../types';
import { LINK_DENY_LIST, PER_RECORD_DENY } from './linkingConfig';

// ─── Stoplist ─────────────────────────────────────────────────────────────
// Common English words that should NOT be auto-linked as single tokens.
// Multi-word phrases containing these words are still linkable (e.g., "The One").
const STOPLIST = new Set([
  'one', 'two', 'form', 'art', 'soul', 'mind', 'body', 'life', 'time', 'text',
  'book', 'term', 'type', 'note', 'view', 'core', 'base', 'mode', 'part', 'role',
  'case', 'fact', 'idea', 'kind', 'work', 'good', 'true', 'real', 'self',
  'this', 'that', 'with', 'from', 'into', 'upon', 'also', 'even', 'only',
  'over', 'about', 'both', 'each', 'some', 'many', 'other', 'such', 'same',
  'great', 'first', 'second', 'later', 'early', 'light', 'fire', 'water', 'earth',
  'spirit', 'nature', 'power', 'matter', 'world', 'order', 'level', 'point',
  'sense', 'place', 'thing', 'being', 'truth', 'three', 'four', 'five', 'seven',
  'known', 'based', 'found', 'given', 'taken', 'used', 'made', 'said', 'came',
  'went', 'came', 'came', 'born', 'died', 'name', 'love', 'will', 'shall',
  'must', 'more', 'less', 'most', 'also', 'thus', 'very', 'much', 'well',
  'long', 'high', 'deep', 'full', 'pure', 'holy', 'dark', 'void', 'true',
  'east', 'west', 'above', 'below', 'inner', 'outer', 'prime',
]);

// ─── Normalisation ─────────────────────────────────────────────────────────
/**
 * Normalise a string for use as an index lookup key.
 * Keeps hyphens (al-Buni) and apostrophes intact so multi-word names work.
 */
export function normalizeToken(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, '') // strip curly quotes
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Index Builder ─────────────────────────────────────────────────────────
export function buildLinkableIndex(data: AppData): LinkableIndex {
  const termMap = new Map<string, LinkTarget[]>();

  function addTerm(raw: string, target: LinkTarget) {
    const k = normalizeToken(raw);
    if (k.length < 4) return;
    // Block single-word stoplist entries (multi-word phrases bypass this)
    if (!k.includes(' ') && STOPLIST.has(k)) return;
    // Block per-term deny list entries (corpus-specific overrides)
    if (LINK_DENY_LIST.has(k)) return;
    const existing = termMap.get(k) ?? [];
    if (!existing.find(t => t.id === target.id)) {
      termMap.set(k, [...existing, target]);
    }
  }

  // 1. Entities — label + all aliases
  // Skips entities with linkable === false or in PER_RECORD_DENY.
  for (const e of data.entities) {
    if ((e as { linkable?: boolean }).linkable === false) continue;
    if (PER_RECORD_DENY.has(e.id)) continue;
    const target: LinkTarget = {
      id: e.id,
      label: e.label,
      type: 'entity',
      entityType: e.type,
      route: `/entities/${e.id}`,
      blurb: e.blurb || undefined,
    };
    addTerm(e.label, target);
    for (const alias of (e.aliases ?? [])) {
      addTerm(alias, target);
    }
  }

  // 2. Alchemy concepts — term field
  // Skips concepts with linkable === false or in PER_RECORD_DENY.
  for (const ac of data.alchemyConcepts) {
    if ((ac as { linkable?: boolean }).linkable === false) continue;
    if (PER_RECORD_DENY.has(ac.id)) continue;
    const target: LinkTarget = {
      id: ac.id,
      label: ac.term,
      type: 'alchemy',
      route: `/alchemy#${ac.id}`,
      blurb: ac.definition ? ac.definition.slice(0, 130) : undefined,
    };
    addTerm(ac.term, target);
  }

  // 3. Topics — name field only (connections phrases are too broad)
  // Skips topics with linkable === false.
  for (const t of data.topics) {
    if ((t as { linkable?: boolean }).linkable === false) continue;
    const topicId = String(t.rank);
    const target: LinkTarget = {
      id: topicId,
      label: t.name,
      type: 'topic',
      route: `/topics#${topicId}`,
      blurb: t.what_it_is ? t.what_it_is.slice(0, 130) : undefined,
    };
    addTerm(t.name, target);
  }

  // Sort longest first for greedy matching (prevents partial matches)
  const sortedTerms = [...termMap.keys()].sort((a, b) => b.length - a.length);

  return { termMap, sortedTerms };
}

// ─── Exclusion Zones ───────────────────────────────────────────────────────
/**
 * Returns [start, end) pairs of character ranges that must not be linkified.
 * Covers: inline code (`…`), URLs (https://…), Windows/Unix file paths.
 */
function getExclusionRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  let m: RegExpExecArray | null;

  // Inline code spans: `…`
  const codeRe = /`[^`]+`/g;
  while ((m = codeRe.exec(text)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }

  // URLs
  const urlRe = /https?:\/\/\S+/g;
  while ((m = urlRe.exec(text)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }

  // File paths (heuristic: drive letter or leading slash + word chars)
  const pathRe = /(?:[A-Za-z]:\\|\/[\w./\\-]{4,})\S*/g;
  while ((m = pathRe.exec(text)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }

  return ranges.sort((a, b) => a[0] - b[0]);
}

function inExcludedRange(pos: number, ranges: [number, number][]): boolean {
  for (const [s, e] of ranges) {
    if (pos >= s && pos < e) return true;
    if (s > pos) break;
  }
  return false;
}

// ─── Word Boundary Helpers ─────────────────────────────────────────────────
function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}_]/u.test(ch);
}

function isWordBoundaryStart(text: string, pos: number): boolean {
  if (pos === 0) return true;
  return !isWordChar(text[pos - 1]);
}

function isWordBoundaryEnd(text: string, pos: number): boolean {
  if (pos >= text.length) return true;
  return !isWordChar(text[pos]);
}

// ─── Scanner ───────────────────────────────────────────────────────────────
export interface TextMatch {
  start: number;
  end: number;
  text: string;
  targets: LinkTarget[];
}

/**
 * Scan `text` for all term matches in `index`.
 * Uses greedy longest-match: tries longest terms first at each position.
 * Never crosses exclusion ranges; respects word boundaries.
 *
 * @param maxChars — limit scanning to first N chars (default unlimited).
 *                   Callers on long pages should pass 3000 or similar.
 */
export function scanText(
  text: string,
  index: LinkableIndex,
  maxChars?: number,
): TextMatch[] {
  if (!text || index.sortedTerms.length === 0) return [];

  const cap = maxChars != null ? Math.min(text.length, maxChars) : text.length;
  const scanTarget = text.slice(0, cap);
  const lower = scanTarget.toLowerCase().normalize('NFKC');
  const exclusions = getExclusionRanges(scanTarget);
  const matches: TextMatch[] = [];
  let i = 0;

  while (i < cap) {
    if (inExcludedRange(i, exclusions)) { i++; continue; }
    if (!isWordBoundaryStart(scanTarget, i)) { i++; continue; }

    let hit = false;
    for (const term of index.sortedTerms) {
      const tLen = term.length;
      if (i + tLen > cap) continue;
      if (lower.slice(i, i + tLen) !== term) continue;

      const endPos = i + tLen;
      if (!isWordBoundaryEnd(scanTarget, endPos)) continue;
      if (inExcludedRange(endPos - 1, exclusions)) continue;

      matches.push({
        start: i,
        end: endPos,
        text: scanTarget.slice(i, endPos),
        targets: index.termMap.get(term)!,
      });
      i = endPos;
      hit = true;
      break;
    }
    if (!hit) i++;
  }

  return matches;
}
