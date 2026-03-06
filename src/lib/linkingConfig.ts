/**
 * linkingConfig.ts — editorial overrides for the autolinking system.
 *
 * LINK_DENY_LIST: Per-term suppression list.
 *   Add a normalized (NFKC, lowercase) term here to unconditionally suppress
 *   autolinking for that term everywhere in the UI, even if it appears in the
 *   entity/alchemy/topic index. Unlike the STOPLIST (which targets common English
 *   words), this list handles corpus-specific false positives — short ambiguous
 *   labels, terms used in casual prose that should NOT link, etc.
 *
 * Usage:
 *   import { LINK_DENY_LIST } from './linkingConfig';
 *   if (LINK_DENY_LIST.has(normalizeToken(term))) return;
 *
 * All entries must be pre-normalized (lowercase, NFKC, no curly quotes, trimmed).
 */
export const LINK_DENY_LIST = new Set<string>([
  // ── Short ambiguous terms ──────────────────────────────────────────────────
  // 'mercury',   // uncomment to suppress "Mercury" planet/element links
  // 'mars',      // uncomment to suppress "Mars" ambiguity
  // 'saturn',
  // 'venus',

  // ── Add corpus-specific overrides below this line ─────────────────────────
  // Format: 'normalized term here',
]);

/**
 * PER_RECORD_DENY: entity/alchemy/topic IDs that should never be linked,
 * regardless of the `linkable` field in their JSON record.
 * Prefer setting `"linkable": false` in the source JSON instead; use this
 * only when you cannot edit the source file.
 */
export const PER_RECORD_DENY = new Set<string>([
  // 'tool_sqlite',  // example: suppress the SQLite tool entity
]);
