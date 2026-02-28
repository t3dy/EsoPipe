#!/usr/bin/env python3
"""
extract_tables.py  —  EsoPipe Real Table Extractor  (v2)
=========================================================
Parses raw HTML files from the ChatGPT export directory to extract every
Markdown pipe-delimited table and HTML <table> element found in assistant
turns.  Pairs each table with its preceding user request, infers column
types, and exports results as tables_mined.json for the EsoPipe website.

WHY NOT USE THE DB?
The mine_chats.py parser stores content via html.parser callbacks, joining
text nodes and then running re.sub(r"\\s+", " ", text) which collapses all
newlines.  Markdown pipe tables depend on line breaks; stripping them
produces a single unstructured string.  This script reads raw HTML directly,
preserving newlines, then strips only inline formatting.

FORMATS HANDLED:
  1. Markdown pipe tables  — | col | col | with a |---| separator line
     (the most common format; headers are often bold: | <strong>X</strong> |)
  2. HTML <table> elements — rendered tables with <thead>/<tbody>/<tr>/<td>

Usage:
    python extract_tables.py [--dir PATH] [--db PATH] [--out PATH]
                             [--min-cols N] [--min-rows N] [--limit N]

Defaults:
    --dir      .  (directory containing *.html chat exports)
    --db       esoteric_archive.db
    --out      cs-magical-scholarship/public/data/tables_mined.json
    --min-cols 3
    --min-rows 2
"""

import argparse
import html as html_lib
import json
import re
import sqlite3
import sys
from html.parser import HTMLParser
from pathlib import Path

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ─── Strip tags regex (for cleaning after text collection) ───────────────────
_STRIP_TAGS = re.compile(r"<[^>]+>")


# ─── Column name → ColType mapping ───────────────────────────────────────────
COL_TYPE_MAP: dict[str, str] = {
    # figure / person
    "figure": "figure", "scholar": "figure", "scholars": "figure",
    "alchemist": "figure", "alchemists": "figure", "thinker": "figure",
    "thinkers": "figure", "philosopher": "figure", "philosophers": "figure",
    "author": "figure", "authors": "figure", "name": "figure",
    "person": "figure", "artist": "figure", "artists": "figure",
    "magician": "figure", "historian": "figure", "historian/scholar": "figure",
    "mystic": "figure", "writer": "figure", "practitioner": "figure",
    "biography": "figure", "bio": "figure",
    # works / texts
    "works": "works", "work": "works", "texts": "works", "text": "works",
    "publications": "works", "books": "works", "writings": "works",
    "sources": "works", "source": "works", "editions": "works",
    "key works": "works", "key texts": "works", "major works": "works",
    "treatises": "works", "manuscripts": "works",
    # contributions
    "contributions": "contributions", "contribution": "contributions",
    "advances": "contributions", "achievements": "contributions",
    "significance": "contributions", "importance": "contributions",
    "innovation": "contributions", "innovations": "contributions",
    "key contributions": "contributions",
    # challenges
    "challenges": "challenges", "challenge": "challenges",
    "critiques": "challenges", "critique": "challenges",
    "problems": "challenges", "difficulties": "challenges",
    "objections": "challenges", "criticism": "challenges",
    "criticisms": "challenges", "counter-arguments": "challenges",
    "limitations": "challenges", "weaknesses": "challenges",
    # quotation / evidence
    "quotation": "quotation", "quotations": "quotation",
    "quote": "quotation", "quotes": "quotation",
    "passage": "quotation", "passages": "quotation",
    "excerpt": "quotation", "excerpts": "quotation",
    "evidence": "quotation", "key quote": "quotation",
    "example": "quotation", "examples": "quotation",
    "citation": "quotation", "citations": "quotation",
    # takeaway
    "takeaway": "takeaway", "takeaways": "takeaway",
    "synthesis": "takeaway", "conclusion": "takeaway",
    "conclusions": "takeaway", "key takeaway": "takeaway",
    "implications": "takeaway", "significance for research": "takeaway",
    "relevance": "takeaway", "so what": "takeaway",
    "assessment": "takeaway", "evaluation": "takeaway",
    # lacunae
    "lacunae": "lacunae", "lacuna": "lacunae",
    "gaps": "lacunae", "gap": "lacunae",
    "missing": "lacunae", "unknowns": "lacunae",
    "open questions": "lacunae", "mysteries": "lacunae",
    "unresolved": "lacunae", "lacunae/gaps": "lacunae",
    # methodology
    "methodology": "methodology", "method": "methodology",
    "methods": "methodology", "approach": "methodology",
    "technique": "methodology", "techniques": "methodology",
    "framework": "methodology", "theoretical framework": "methodology",
    # content / summary
    "contents": "content", "content": "content",
    "summary": "content", "description": "content",
    "overview": "content", "topics": "content",
    "subject": "content", "argument": "content",
    "main argument": "content", "claim": "content",
    "theme": "content", "themes": "content",
    "key ideas": "content", "ideas": "content",
    "discussion": "content", "points": "content",
    # context / historical framing
    "context": "context", "background": "context",
    "period": "context", "historical context": "context",
    "setting": "context", "date": "context", "dates": "context",
    "century": "context", "era": "context", "time": "context",
    "location": "context", "place": "context",
    # tradition / philosopher column (comparison tables)
    "tradition": "tradition",
    "plato": "tradition", "platonic": "tradition",
    "aristotle": "tradition", "aristotelian": "tradition",
    "plotinus": "tradition", "proclus": "tradition",
    "iamblichus": "tradition", "porphyry": "tradition",
    "ficino": "tradition", "pico": "tradition",
    "bruno": "tradition", "agrippa": "tradition", "paracelsus": "tradition",
    "medieval": "tradition", "medieval context": "tradition",
    "renaissance": "tradition", "renaissance context": "tradition",
    "ancient": "tradition", "ancient greek": "tradition",
    "neoplatonic": "tradition", "neoplatonism": "tradition",
    "islamic": "tradition", "jewish": "tradition",
    "greek": "tradition", "latin": "tradition",
    "early modern": "tradition",
    # notes / catch-all
    "notes": "notes", "note": "notes",
    "additional notes": "notes", "remarks": "notes",
    "observations": "notes", "comments": "notes",
    "miscellaneous": "notes", "other": "notes",
}

CONCEPT_FIRST_COL = {
    "concept", "term", "idea", "principle", "doctrine", "topic",
    "theme", "element", "aspect", "category", "property", "attribute",
    "feature", "type", "kind", "form", "stage", "phase", "operation",
    "process", "practice", "symbol", "image", "motif", "step",
    "argument", "claim", "theory", "hypothesis",
}

TEMPLATE_RULES: list[tuple[set, str]] = [
    ({"plato", "aristotle", "plotinus", "proclus", "ficino", "bruno", "iamblichus"},
     "philosophical-comparison"),
    ({"contributions", "challenges"}, "scholar-profile"),
    ({"lacunae", "lacuna"}, "evidence-audit"),
    ({"contents", "methodology"}, "article-decomposition"),
    ({"summary", "methodology"}, "article-decomposition"),
    ({"content", "methodology"}, "article-decomposition"),
]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def infer_col_type(header: str, col_index: int, all_headers: list[str]) -> str:
    h = header.lower().strip()
    if h in COL_TYPE_MAP:
        return COL_TYPE_MAP[h]
    for key, ctype in COL_TYPE_MAP.items():
        if key in h:
            return ctype
    if col_index == 0:
        if any(w in h for w in ["scholar", "figure", "alchemist", "author", "philosopher"]):
            return "figure"
        if any(w in h for w in CONCEPT_FIRST_COL):
            return "concept"
        return "concept"
    return "notes"


def infer_template(col_names: list[str]) -> str:
    lower_cols = {c.lower() for c in col_names}
    for trigger_set, template in TEMPLATE_RULES:
        if trigger_set & lower_cols:
            return template
    return "inventory"


def clean_cell(text: str) -> str:
    """Clean a table cell: strip inline HTML, unescape entities, normalise whitespace."""
    text = _STRIP_TAGS.sub("", text)
    text = html_lib.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    # Remove leftover Markdown bold/italic markers
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    return text


# ─── Markdown pipe-table parser ───────────────────────────────────────────────

def _split_pipe_row(line: str) -> list[str]:
    """Split a Markdown table row into cells, stripping leading/trailing pipes."""
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def parse_markdown_tables(text: str) -> list[dict]:
    """
    Extract all Markdown pipe-delimited tables from a text block.
    Returns list of dicts with keys: columns (list[str]), rows (list[list[str]]).
    Text nodes may contain inline HTML; cell contents are passed through clean_cell().
    """
    if not text:
        return []

    lines = text.split("\n")
    tables = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # A table row starts with optional whitespace then a pipe
        if re.match(r"\s*\|", line):
            block = []
            j = i
            while j < len(lines) and re.match(r"\s*\|", lines[j]):
                block.append(lines[j])
                j += 1

            if len(block) >= 3:
                sep_line = block[1]
                # Separator: contains only pipes, dashes, colons, spaces
                if re.match(r"\s*\|[\s\-=|:]+\|?\s*$", sep_line):
                    raw_headers = _split_pipe_row(block[0])
                    raw_rows = [
                        _split_pipe_row(b)
                        for b in block[2:]
                        if b.strip() and b.strip() != "|"
                    ]
                    headers = [clean_cell(h) for h in raw_headers]
                    rows = [[clean_cell(c) for c in row] for row in raw_rows]
                    # Filter: meaningful headers (not all dashes/blanks)
                    real_headers = [h for h in headers if h and not re.match(r"^[-:]+$", h)]
                    if len(real_headers) >= 2 and len(rows) >= 1:
                        tables.append({"columns": headers, "rows": rows})
            i = j
        else:
            i += 1
    return tables


# ─── HTML-format table parser (inside <table> elements) ─────────────────────

def parse_html_table_element(rows_raw: list[list[str]]) -> dict | None:
    """Convert a list of raw table rows (header + data) to our dict format."""
    if not rows_raw or len(rows_raw) < 2:
        return None
    headers = [clean_cell(c) for c in rows_raw[0]]
    rows = [[clean_cell(c) for c in row] for row in rows_raw[1:]]
    real_headers = [h for h in headers if h]
    if len(real_headers) < 2 or not rows:
        return None
    return {"columns": headers, "rows": rows}


# ─── Custom HTML parser that preserves newlines ───────────────────────────────

class TableExtractParser(HTMLParser):
    """
    Parses Format B ChatGPT HTML exports.

    Key difference from mine_chats.py's ChatHTMLParser:
    - Collects text with NEWLINES PRESERVED (does not collapse \\s+)
    - Converts <br> to \\n
    - Adds \\n after block-level tags (p, li, h1-h6)
    - Also extracts HTML <table> elements directly

    Result: assistant turns contain Markdown pipe-table structure intact.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.turns: list[dict] = []          # {role, content, html_tables}

        self._div_depth      = 0
        self._msg_role: str | None = None
        self._msg_div_depth  = -1
        self._in_role_div    = False
        self._role_div_depth = -1
        self._collecting     = False
        self._parts: list[str] = []

        # HTML <table> state
        self._table_stack: list[dict] = []   # stack of table state dicts
        self._in_cell        = False
        self._cell_parts: list[str] = []
        self._html_tables_this_msg: list[dict] = []

    # ── helpers ──────────────────────────────────────────────────────────────

    @property
    def _in_table(self) -> bool:
        return bool(self._table_stack)

    def _cur_table(self) -> dict | None:
        return self._table_stack[-1] if self._table_stack else None

    def _commit_content(self) -> str:
        """Join collected text parts, preserving newlines, strip residual HTML."""
        raw = "".join(self._parts)
        # Strip any residual HTML tags (there shouldn't be many)
        raw = _STRIP_TAGS.sub("", raw)
        # Per-line whitespace normalisation only (preserve newlines)
        lines = [re.sub(r"[ \t]+", " ", ln) for ln in raw.split("\n")]
        return "\n".join(lines).strip()

    # ── tag handlers ─────────────────────────────────────────────────────────

    def handle_starttag(self, tag: str, attrs):
        attrs_d = dict(attrs)
        cls     = attrs_d.get("class", "")
        classes = cls.split()

        # ── div tracking ──────────────────────────────────────────────────
        if tag == "div":
            self._div_depth += 1

            if "msg" in classes:
                role = next((c for c in classes if c != "msg"), "unknown")
                self._msg_role             = role
                self._msg_div_depth        = self._div_depth
                self._parts                = []
                self._collecting           = False
                self._html_tables_this_msg = []
                return

            if self._msg_role is not None and "role" in classes:
                self._in_role_div    = True
                self._role_div_depth = self._div_depth
                return

        # ── line breaks ───────────────────────────────────────────────────
        if tag == "br":
            if self._collecting and not self._in_role_div and not self._in_cell:
                self._parts.append("\n")
            elif self._in_cell:
                self._cell_parts.append("\n")
            return

        # ── block-level → insert newline ──────────────────────────────────
        if tag in ("p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"):
            if self._collecting and not self._in_role_div and not self._in_cell:
                self._parts.append("\n")
            return

        # ── HTML table handling ───────────────────────────────────────────
        if tag == "table" and self._collecting and not self._in_role_div:
            self._table_stack.append({
                "headers":     [],
                "rows":        [],
                "current_row": [],
                "in_thead":    False,
            })
            return

        if self._in_table:
            ct = self._cur_table()
            if ct is not None:
                if tag == "thead":
                    ct["in_thead"] = True
                elif tag == "tbody":
                    ct["in_thead"] = False
                elif tag == "tr":
                    ct["current_row"] = []
                elif tag in ("th", "td"):
                    self._in_cell    = True
                    self._cell_parts = []
            return

        # ── enable text collection ────────────────────────────────────────
        if self._msg_role and not self._in_role_div and self._msg_div_depth >= 0:
            self._collecting = True

    def handle_endtag(self, tag: str):
        # ── div tracking ──────────────────────────────────────────────────
        if tag == "div":
            # Close role div
            if self._in_role_div and self._div_depth == self._role_div_depth:
                self._in_role_div    = False
                self._role_div_depth = -1
                self._collecting     = True
                self._div_depth     -= 1
                return

            # Close message div
            if self._msg_role and self._div_depth == self._msg_div_depth:
                content = self._commit_content()
                self.turns.append({
                    "role":        self._msg_role,
                    "content":     content,
                    "html_tables": self._html_tables_this_msg[:],
                })
                self._msg_role             = None
                self._msg_div_depth        = -1
                self._collecting           = False
                self._parts                = []
                self._html_tables_this_msg = []
                self._div_depth           -= 1
                return

            self._div_depth -= 1
            return

        # ── block-level → newline after ──────────────────────────────────
        if tag in ("p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"):
            if self._collecting and not self._in_role_div and not self._in_cell:
                self._parts.append("\n")
            return

        # ── HTML table tracking ───────────────────────────────────────────
        if tag == "table" and self._table_stack:
            ct = self._table_stack.pop()
            # Build table dict from captured rows
            all_rows = ct["headers_raw"] if ct.get("headers_raw") else []
            headers  = ct["headers"]
            data_rows = ct["rows"]
            if not headers and data_rows:
                headers   = data_rows[0]
                data_rows = data_rows[1:]
            tbl = parse_html_table_element([headers] + data_rows)
            if tbl:
                self._html_tables_this_msg.append(tbl)
            return

        if self._in_table:
            ct = self._cur_table()
            if ct is not None:
                if tag == "thead":
                    ct["in_thead"] = False
                elif tag == "tr":
                    row = [c.strip() for c in ct["current_row"]]
                    if ct["in_thead"] or not ct["headers"]:
                        ct["headers"] = row
                    else:
                        ct["rows"].append(row)
                    ct["current_row"] = []
                elif tag in ("th", "td"):
                    cell = html_lib.unescape("".join(self._cell_parts)).strip()
                    cell = re.sub(r"\s+", " ", cell)
                    ct["current_row"].append(cell)
                    self._in_cell    = False
                    self._cell_parts = []
            return

    def handle_data(self, data: str):
        if self._in_cell:
            self._cell_parts.append(data)
            return
        if self._collecting and not self._in_role_div:
            self._parts.append(data)


def parse_html_file(path: Path) -> list[dict]:
    """Parse a ChatGPT HTML export; return list of turn dicts."""
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            raw = f.read()
    except Exception as e:
        print(f"  [WARN] Cannot read {path.name}: {e}", file=sys.stderr)
        return []

    parser = TableExtractParser()
    try:
        parser.feed(raw)
    except Exception as e:
        print(f"  [WARN] Parse error {path.name}: {e}", file=sys.stderr)
    return parser.turns


# ─── Conversion to EsoPipe format ────────────────────────────────────────────

def tables_to_esopipe(
    raw_tables: list[dict],
    min_cols: int = 3,
    min_rows: int = 2,
    limit: int | None = None,
) -> list[dict]:
    results = []
    seen_fps: set[str] = set()

    for i, rt in enumerate(raw_tables):
        cols = rt["columns"]
        rows = rt["rows"]
        conv_title = rt.get("conversation_title", "")
        conv_date  = rt.get("conversation_date", "")
        user_req   = rt.get("user_request", "")

        if len(cols) < min_cols or len(rows) < min_rows:
            continue

        # Normalise row length
        n = len(cols)
        norm_rows = []
        for row in rows:
            if len(row) >= n:
                norm_rows.append(row[:n])
            else:
                norm_rows.append(row + [""] * (n - len(row)))

        # Deduplication fingerprint
        fp_parts = sorted(c.lower() for c in cols)
        if norm_rows:
            fp_parts.append(norm_rows[0][0][:40].lower())
        fp = "|".join(fp_parts)
        if fp in seen_fps:
            continue
        seen_fps.add(fp)

        template = infer_template(cols)
        table_columns = []
        for ci, col_name in enumerate(cols):
            col_type = infer_col_type(col_name, ci, cols)
            if ci == 0:
                w = max(12, int(100 / (len(cols) + 0.5)))
            else:
                w = int((100 - 14) / max(len(cols) - 1, 1))
            table_columns.append({
                "id":    f"col_{ci}",
                "label": col_name,
                "type":  col_type,
                "width": str(min(w, 30)),
            })

        table_rows = [
            {f"col_{ci}": cell for ci, cell in enumerate(row)}
            for row in norm_rows
        ]

        score = len(cols) * len(norm_rows)
        slug  = re.sub(r"[^a-z0-9]+", "_", conv_title.lower())[:40].strip("_")
        table_id = f"mined_{slug}_{i:04d}"

        results.append({
            "id":                 table_id,
            "template":           template,
            "title":              conv_title,
            "description":        (user_req[:200] + "…") if len(user_req) > 200 else user_req,
            "tags":               ["mined"],
            "source":             "mined",
            "conversation_title": conv_title,
            "conversation_date":  conv_date,
            "user_request":       user_req[:400],
            "columns":            table_columns,
            "rows":               table_rows,
            "_score":             score,
        })

    results.sort(key=lambda t: t["_score"], reverse=True)
    for t in results:
        del t["_score"]
    if limit:
        results = results[:limit]
    return results


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir",      default=".")
    ap.add_argument("--db",       default="esoteric_archive.db")
    ap.add_argument("--out",      default="cs-magical-scholarship/public/data/tables_mined.json")
    ap.add_argument("--min-cols", type=int, default=3)
    ap.add_argument("--min-rows", type=int, default=2)
    ap.add_argument("--limit",    type=int, default=None)
    ap.add_argument("--verbose",  action="store_true")
    args = ap.parse_args()

    html_dir = Path(args.dir).resolve()
    db_path  = Path(args.db).resolve()
    out_path = Path(args.out).resolve()

    print(f"\nEsoPipe Table Extractor v2")
    print(f"  HTML dir  : {html_dir}")
    print(f"  Database  : {db_path}")
    print(f"  Output    : {out_path}")
    print(f"  Filters   : min {args.min_cols} cols, min {args.min_rows} rows")
    print()

    # ── Load conversation metadata from DB ───────────────────────────────────
    conv_meta: dict[str, tuple[str, str]] = {}  # filename → (title, date)
    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        for row in conn.execute("SELECT filename, title, date FROM conversations").fetchall():
            conv_meta[row[0]] = (row[1] or "", row[2] or "")
        conn.close()
        print(f"  Loaded metadata for {len(conv_meta)} conversations from DB")
    else:
        print(f"  [WARN] DB not found at {db_path} — using filenames as titles")

    # ── Scan HTML files ──────────────────────────────────────────────────────
    _skip = {"topic_catalog.html"}
    html_files = sorted(
        p for p in html_dir.glob("*.html")
        if p.name not in _skip
    )
    print(f"  Found {len(html_files)} HTML files to scan\n")

    all_raw: list[dict] = []
    n_files_with_tables = 0
    n_md_tables = 0
    n_html_tables = 0
    col_freq: dict[str, int] = {}

    for html_path in html_files:
        conv_title, conv_date = conv_meta.get(html_path.name, (html_path.stem, ""))
        turns = parse_html_file(html_path)

        file_had_table = False
        last_user_req  = ""

        for turn in turns:
            if turn["role"] == "user":
                last_user_req = turn["content"][:400]
                continue

            if turn["role"] != "assistant":
                continue

            # ── Markdown pipe tables ────────────────────────────────────────
            md_tables = parse_markdown_tables(turn["content"])
            for tbl in md_tables:
                n_md_tables += 1
                file_had_table = True
                for c in tbl["columns"]:
                    key = c.strip().lower()
                    col_freq[key] = col_freq.get(key, 0) + 1
                all_raw.append({
                    "columns":            tbl["columns"],
                    "rows":               tbl["rows"],
                    "conversation_title": conv_title,
                    "conversation_date":  conv_date,
                    "user_request":       last_user_req,
                    "source_type":        "markdown",
                })
                if args.verbose:
                    print(f"  [MD] {conv_title[:40]:40} cols={len(tbl['columns'])} rows={len(tbl['rows'])}")

            # ── HTML <table> elements ───────────────────────────────────────
            for tbl in turn.get("html_tables", []):
                n_html_tables += 1
                file_had_table = True
                for c in tbl["columns"]:
                    key = c.strip().lower()
                    col_freq[key] = col_freq.get(key, 0) + 1
                all_raw.append({
                    "columns":            tbl["columns"],
                    "rows":               tbl["rows"],
                    "conversation_title": conv_title,
                    "conversation_date":  conv_date,
                    "user_request":       last_user_req,
                    "source_type":        "html_table",
                })
                if args.verbose:
                    print(f"  [HT] {conv_title[:40]:40} cols={len(tbl['columns'])} rows={len(tbl['rows'])}")

        if file_had_table:
            n_files_with_tables += 1

    print(f"Results:")
    print(f"  Files containing tables : {n_files_with_tables}")
    print(f"  Markdown pipe tables    : {n_md_tables}")
    print(f"  HTML <table> elements   : {n_html_tables}")
    print(f"  Total raw tables        : {len(all_raw)}")

    # ── Column frequency report ──────────────────────────────────────────────
    print()
    print("TOP 30 COLUMN NAMES:")
    for name, count in sorted(col_freq.items(), key=lambda x: -x[1])[:30]:
        print(f"  {name:40} {count:>4}")

    freq_path = html_dir / "column_name_frequency.csv"
    with open(freq_path, "w", encoding="utf-8") as f:
        f.write("column_name,count\n")
        for name, count in sorted(col_freq.items(), key=lambda x: -x[1]):
            f.write(f'"{name}",{count}\n')
    print(f"\n  Column frequency saved -> {freq_path}")

    # ── Convert to EsoPipe JSON ──────────────────────────────────────────────
    print("\nConverting to EsoPipe JSON…")
    esopipe_tables = tables_to_esopipe(
        all_raw,
        min_cols=args.min_cols,
        min_rows=args.min_rows,
        limit=args.limit,
    )
    print(f"  Tables passing filters  : {len(esopipe_tables)}")

    # Template breakdown
    template_counts: dict[str, int] = {}
    for t in esopipe_tables:
        template_counts[t["template"]] = template_counts.get(t["template"], 0) + 1
    print()
    print("  Tables by template:")
    for tmpl, cnt in sorted(template_counts.items(), key=lambda x: -x[1]):
        print(f"    {tmpl:35} {cnt}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(esopipe_tables, f, indent=2, ensure_ascii=False)
    print(f"\n  Saved -> {out_path}")

    # ── Sample output ────────────────────────────────────────────────────────
    if esopipe_tables:
        first = esopipe_tables[0]
        print(f"\nTop table: {first['title']}")
        print(f"  Template  : {first['template']}")
        print(f"  Columns   : {[c['label'] for c in first['columns']]}")
        print(f"  Rows      : {len(first['rows'])}")
        print(f"  User asked: {first['user_request'][:120]}")

    print("\nDone.")


if __name__ == "__main__":
    main()
