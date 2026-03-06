# Semantic Linking System

EsoPipe's semantic linking system automatically transforms entity names, alchemy terms, and topic names into navigable inline links wherever they appear in reader-facing prose — turning the site's text into a traversable knowledge graph.

---

## Overview

Any passage rendered through `<LinkifyText>` becomes "live": every recognized term becomes a dotted underline that, on hover (or first tap on mobile), shows a preview card, and on click navigates to the entity, topic, or alchemy concept page.

The system is designed around four principles:

1. **Accuracy over coverage** — a missed link is better than a wrong link. Strict word-boundary and stoplist rules prevent false positives.
2. **Editorial control** — every record can opt out; a deny list handles corpus-specific overrides.
3. **Deterministic output** — greedy longest-match with sorted terms ensures the same text always produces the same links.
4. **Performance safety** — linkification is limited to the first N characters by default, with an expand toggle for long documents.

---

## Architecture

```
AppData (entities + alchemyConcepts + topics)
    │
    ▼
buildLinkableIndex()         ← src/lib/LinkableIndex.ts
    │   Normalizes labels/aliases → termMap (Map<string, LinkTarget[]>)
    │   Sorts by length (longest-first) for greedy matching
    │
    ▼
LinkableIndex { termMap, sortedTerms }
    │   stored in AppContext, built once on data load
    │
    ▼
scanText(text, index, maxChars?)  ← src/lib/LinkableIndex.ts
    │   Greedy longest-match scanner
    │   Respects exclusion zones + word boundaries
    │   Returns TextMatch[] {start, end, text, targets}
    │
    ▼
<LinkifyText text={...} maxChars={2000} />  ← src/components/LinkifyText.tsx
    │   Interleaves plain-text strings and <EntityLink> nodes
    │   Shows "Show more links ↓" toggle when text exceeds maxChars
    │
    ▼
<EntityLink targets={[...]} />  ← src/components/EntityLink.tsx
    │   Single target: hover → <HoverCard>; click → navigate
    │   Multiple targets: click → <DisambiguationPopover>
    │   Mobile: first tap → preview; second tap → navigate
    │
    ├── <HoverCard>                ← src/components/HoverCard.tsx
    │   Portal-rendered, fixed-positioned
    │   Shows: type badge, label, blurb, co-entities, actions
    │
    └── <DisambiguationPopover>   ← src/components/DisambiguationPopover.tsx
        Portal-rendered chooser; closes on outside click or Escape
```

---

## The LinkableIndex

### buildLinkableIndex(data: AppData): LinkableIndex

Builds a vocabulary index at runtime from three sources:

| Source | Field used | Target type |
|--------|-----------|-------------|
| `data.entities` | `label` + `aliases[]` | `'entity'` |
| `data.alchemyConcepts` | `term` | `'alchemy'` |
| `data.topics` | `name` | `'topic'` |

Each unique normalized term maps to one or more `LinkTarget` objects. If a term maps to multiple targets, clicking it opens the disambiguation popover.

### normalizeToken(s: string): string

All terms are normalized before indexing and before matching:

1. Unicode NFKC normalization
2. Lowercase
3. Strip curly quotes (`\u2018`, `\u2019`, `\u201c`, `\u201d`)
4. Collapse whitespace + trim

This ensures "Ficino", "ficino", and "Ficino " all match the same index entry.

### Minimum length rule

Terms shorter than **4 characters** after normalization are never indexed. This prevents micro-terms like "one", "two", "al" from polluting the index.

---

## Stoplist

Single-word tokens that appear in `STOPLIST` (defined in `LinkableIndex.ts`) are excluded from the index even if a matching entity exists. The stoplist targets common English words that appear in entity names but are too semantically broad to be useful standalone links.

Current stoplist includes ~70 words covering:
- Articles/prepositions in isolation: "from", "with", "into", "upon"
- Common scholarly adjectives: "great", "early", "inner", "pure", "holy"
- Domain words too broad to link usefully: "soul", "mind", "body", "spirit", "matter", "world"
- Ordinals and numbers: "first", "second", "three", "four", "five", "seven"

**Multi-word phrases bypass the stoplist.** "The One" links correctly even though "one" is stoplist-blocked.

To add a word to the stoplist, edit the `STOPLIST` constant in `src/lib/LinkableIndex.ts`.

---

## Editorial Controls

### 1. Per-record `linkable: boolean`

Any entity in `entities.json` can be excluded from autolinking by setting:

```json
{
  "id": "tool_sqlite",
  "type": "tool",
  "label": "SQLite",
  "linkable": false,
  ...
}
```

When `linkable` is `false`, neither the label nor any alias is indexed. The same pattern works for alchemy concepts and topics (cast to `{ linkable?: boolean }` in the builder).

### 2. Per-term deny list — `src/lib/linkingConfig.ts`

The `LINK_DENY_LIST` set suppresses specific normalized terms regardless of which records contain them:

```typescript
export const LINK_DENY_LIST = new Set<string>([
  'mercury',   // suppress "Mercury" if it causes false positives
  'mars',
]);
```

Unlike the stoplist (which is global for common English), this list is corpus-specific. Use it for short terms that appear in entity names but are used too casually in prose to justify a link.

### 3. PER_RECORD_DENY

The `PER_RECORD_DENY` set in `linkingConfig.ts` suppresses specific entity IDs without requiring changes to the JSON source files:

```typescript
export const PER_RECORD_DENY = new Set<string>([
  'tool_sqlite',
]);
```

Prefer setting `"linkable": false` in the JSON when possible.

---

## Exclusion Zones

`getExclusionRanges()` (internal to `LinkableIndex.ts`) marks character ranges in source text that must never be linkified:

| Pattern | Excluded by |
|---------|------------|
| `` `inline code` `` | Backtick regex |
| `https://...` URLs | URL regex |
| Windows/Unix file paths | Path heuristic regex |

Matches that would begin or end inside an exclusion range are silently dropped.

---

## Word Boundary Enforcement

Every match must begin and end at a Unicode word boundary. The `isWordChar()` function considers `\p{L}` (letters), `\p{N}` (numbers), and `_` as word characters. A match at position `i` is only accepted if:

- `text[i-1]` is NOT a word character (or `i === 0`)
- `text[i + termLen]` is NOT a word character (or end of text)

This prevents "Plato" from matching inside "Platonism" and prevents "Dee" from matching inside "indeed".

---

## Scanner Performance

`scanText()` uses a **greedy longest-match** strategy:

1. Terms are pre-sorted by decreasing length.
2. At each position `i`, the scanner tries all terms in length order.
3. On first match, it jumps `i` forward by the match length (skipping nested possibilities).
4. Positions inside exclusion ranges are skipped immediately.

This avoids O(n_terms × n_text) behavior for most inputs. For very long texts (conversation turns, full reports), callers pass a `maxChars` limit:

```tsx
<LinkifyText text={longContent} maxChars={2000} />
```

Text beyond the limit is rendered as plain text. A "Show more links ↓" button lets the user expand linkification on demand.

---

## Disambiguation

When a normalized term maps to **two or more** `LinkTarget` values, clicking the linked text opens `<DisambiguationPopover>` — a small portal-rendered overlay listing all targets with type badges. The user selects one to navigate.

Common disambiguation scenarios in this corpus:
- "Mercury" → the metal (alchemy concept) vs. the planet (timeline concept)
- "Bruno" → Giordano Bruno (thinker) vs. other potential matches
- "Dee" → John Dee (thinker) vs. casual use of "dee" in text (blocked by word-boundary rules)

---

## HoverCard

The HoverCard is rendered via `createPortal(card, document.body)` with `position: fixed`, so it escapes all `overflow: hidden` ancestors. It shows:

- **Type dot** (color-coded by entity type)
- **Label** (entity/topic/alchemy term name)
- **Blurb** (first 160 characters of the entity's blurb)
- **Top 3 co-entities** (from `entity_details.json`, clickable)
- **Actions**: "View page →" and "Open in Graph ↓" (1-hop)

The card appears 300ms after cursor enters the link. It stays open if the cursor moves onto the card itself (120ms hide delay on leave). On mobile, the card appears on first tap.

---

## Surfaces Where Linking Is Active

| Surface | Component | Notes |
|---------|-----------|-------|
| Topic portals — `what_it_is` | `Topics.tsx` | Full text, toggle on/off |
| Topic portals — `what_studied`, `open_questions` | `Topics.tsx` | Full text |
| Entity blurb | `EntityDetail.tsx` | Full text |
| Conversation turn content | `ConversationDetail.tsx` | `maxChars=2000`, toggle per-conversation |

Linking is **not** applied to: headings, navigation labels, sidebar chrome, table cells, code blocks, or `<a>` elements.

---

## Toggling Linkification

Where per-surface toggles exist, a Links button (Link2/Link2Off icon from Lucide) in the page toolbar switches linkification on or off. State is local to the page instance (not persisted to localStorage).

---

## Adding New Terms to the Index

The index is built automatically from the JSON data files. To add a new linkable entity:

1. Add the entity to `public/data/entities.json` with `id`, `label`, and optionally `aliases`.
2. The next build will automatically include it in the LinkableIndex.
3. To suppress a specific alias from linking while keeping the entity, move the alias to a separate non-indexed field and update the source JSON.

---

## Testing

Run the unit tests with:

```bash
npm run test
```

Tests cover:
- `normalizeToken` — Unicode + whitespace handling
- `buildLinkableIndex` — STOPLIST, minimum length, `linkable: false`, deny list
- `scanText` — word boundaries, exclusion zones (code spans, URLs), greedy longest-match, `maxChars` truncation
- Ambiguity detection — multiple targets per term
