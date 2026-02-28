#!/usr/bin/env python3
"""
mine_chats.py  —  EsoPipe Scholarly Chat Mining Script
=======================================================
Parses exported ChatGPT HTML conversation files into SQLite, then
produces a topic catalog (attractive HTML), a plain-text report, and
JSON exports for the EsoPipe website.

HTML format (all 249 files share this structure):
    <h1>TITLE</h1>
    <div class="meta">Created: DATE ...</div>
    <div class="msg user"><div class="role user">You</div>TEXT</div>
    <div class="msg assistant"><div class="role assistant">ChatGPT</div>TEXT...</div>
    <div class="msg tool"><div class="role tool">Tool</div>TEXT</div>

Usage:
    python mine_chats.py [--dir PATH] [--db PATH] [--esopipe-dir PATH] [--limit N] [--force]

Defaults:
    --dir        .          (scans for *.html, ignores *.pdf duplicates)
    --db         esoteric_archive.db
    --esopipe-dir  cs-magical-scholarship/public/data/

Outputs:
    esoteric_archive.db     SQLite database
    mine_report.txt         plain-text summary
    topic_catalog.html      visual topic catalog (open in browser)
    entities_mined.json  )
    edges_mined.json     )  written to --esopipe-dir if given
"""

import argparse
import html as html_lib
import json
import os
import re
import sqlite3
import sys
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

# Force UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


# ---------------------------------------------------------------------------
# Entity dictionary  (canonical label -> metadata)
# ---------------------------------------------------------------------------
ENTITY_DICT = {
    # Thinkers
    "Marsilio Ficino": {
        "type": "thinker", "id": "thinker_ficino",
        "aliases": ["Ficino"],
        "tags": ["renaissance", "neoplatonism", "florence", "translation"],
        "blurb": "Florentine philosopher (1433-1499), translated Plato and Corpus Hermeticum, founded Platonic Academy.",
    },
    "Giovanni Pico della Mirandola": {
        "type": "thinker", "id": "thinker_pico",
        "aliases": ["Pico", "Pico della Mirandola"],
        "tags": ["renaissance", "kabbalah", "humanism", "magic"],
        "blurb": "Renaissance philosopher (1463-1494), wrote Oration on the Dignity of Man.",
    },
    "Plotinus": {
        "type": "thinker", "id": "thinker_plotinus",
        "aliases": ["Plotinos"],
        "tags": ["late-antiquity", "neoplatonism", "emanation"],
        "blurb": "Neoplatonist philosopher (c.204-270 CE), author of the Enneads.",
    },
    "Proclus": {
        "type": "thinker", "id": "thinker_proclus",
        "aliases": ["Proklos"],
        "tags": ["late-antiquity", "neoplatonism", "theurgy"],
        "blurb": "Late Neoplatonist philosopher (412-485 CE), head of Platonic Academy in Athens.",
    },
    "Ikhwan al-Safa": {
        "type": "thinker", "id": "thinker_ikhwan",
        "aliases": ["Brethren of Purity", "Ikhwan", "Ikhwan al-Safa'",
                    "Brothers of Purity", "Ikhwan al Safa"],
        "tags": ["islamic", "pythagorean", "encyclopaedia", "10th-century"],
        "blurb": "Anonymous 10th-century Islamic brotherhood who composed the encyclopaedic Rasa'il.",
    },
    "Giordano Bruno": {
        "type": "thinker", "id": "thinker_bruno",
        "aliases": ["Bruno"],
        "tags": ["renaissance", "magic", "memory", "cosmology"],
        "blurb": "Italian philosopher and Dominican friar (1548-1600), art of memory and pantheistic cosmology.",
    },
    "Heinrich Cornelius Agrippa": {
        "type": "thinker", "id": "thinker_agrippa",
        "aliases": ["Agrippa", "Cornelius Agrippa"],
        "tags": ["renaissance", "magic", "kabbalah"],
        "blurb": "German polymath (1486-1535), author of De occulta philosophia.",
    },
    "Paracelsus": {
        "type": "thinker", "id": "thinker_paracelsus",
        "aliases": ["Paracelsus", "Theophrastus Bombastus"],
        "tags": ["renaissance", "alchemy", "medicine"],
        "blurb": "Swiss alchemist and physician (1493-1541), founded iatrochemistry.",
    },
    "Porphyry": {
        "type": "thinker", "id": "thinker_porphyry",
        "aliases": ["Porphyrios"],
        "tags": ["late-antiquity", "neoplatonism", "isagoge"],
        "blurb": "Neoplatonist philosopher (c.233-305 CE), edited the Enneads, author of Isagoge.",
    },
    "Iamblichus": {
        "type": "thinker", "id": "thinker_iamblichus",
        "aliases": ["Iamblichos"],
        "tags": ["late-antiquity", "neoplatonism", "theurgy", "syrian"],
        "blurb": "Syrian Neoplatonist (c.245-325 CE), systematised theurgy, wrote De mysteriis.",
    },
    "Pseudo-Dionysius": {
        "type": "thinker", "id": "thinker_pseudo_dionysius",
        "aliases": ["Pseudo-Dionysius the Areopagite", "Dionysius the Areopagite",
                    "Pseudo Dionysius"],
        "tags": ["late-antiquity", "christian-neoplatonism", "mysticism"],
        "blurb": "Anonymous 5th-6th century Christian Neoplatonist, wrote Celestial Hierarchy.",
    },
    "Hermes Trismegistus": {
        "type": "thinker", "id": "thinker_hermes",
        "aliases": ["Hermes Trismegistos", "Thoth-Hermes"],
        "tags": ["hermeticism", "alchemy", "astrology"],
        "blurb": "Legendary author of the Hermetic corpus; syncretised Hermes and Egyptian Thoth.",
    },
    "John Dee": {
        "type": "thinker", "id": "thinker_dee",
        "aliases": ["Dee", "John Dee"],
        "tags": ["renaissance", "angelic-magic", "enochian", "alchemy"],
        "blurb": "English mathematician and occultist (1527-1608), advisor to Elizabeth I.",
    },
    "Robert Fludd": {
        "type": "thinker", "id": "thinker_fludd",
        "aliases": ["Fludd"],
        "tags": ["renaissance", "rosicrucian", "music-of-the-spheres"],
        "blurb": "English physician and Hermetic philosopher (1574-1637), known for cosmic diagrams.",
    },
    "al-Farabi": {
        "type": "thinker", "id": "thinker_alfarabi",
        "aliases": ["Alfarabi", "al-Farabi", "Alpharabius"],
        "tags": ["islamic", "philosophy", "neoplatonism"],
        "blurb": "Islamic Neoplatonist philosopher (c.872-950 CE).",
    },
    "Ibn Sina": {
        "type": "thinker", "id": "thinker_ibnsina",
        "aliases": ["Avicenna", "Ibn Sina"],
        "tags": ["islamic", "medicine", "philosophy"],
        "blurb": "Persian polymath (980-1037 CE), philosopher-physician.",
    },
    "Ibn Rushd": {
        "type": "thinker", "id": "thinker_ibnrushd",
        "aliases": ["Averroes", "Ibn Rushd"],
        "tags": ["islamic", "aristotle", "philosophy"],
        "blurb": "Andalusian philosopher (1126-1198 CE), major commentator on Aristotle.",
    },
    "Plato": {
        "type": "thinker", "id": "thinker_plato",
        "aliases": ["Platonic", "Platonism", "Platonist"],
        "tags": ["ancient-greek", "philosophy", "forms"],
        "blurb": "Athenian philosopher (c.428-348 BCE), founder of the Academy.",
    },
    "Aristotle": {
        "type": "thinker", "id": "thinker_aristotle",
        "aliases": ["Aristoteles", "Aristotelian", "Aristotelianism"],
        "tags": ["ancient-greek", "philosophy", "logic"],
        "blurb": "Greek philosopher (384-322 BCE), student of Plato.",
    },
    "Pythagoras": {
        "type": "thinker", "id": "thinker_pythagoras",
        "aliases": ["Pythagorean", "Pythagoreans", "Pythagoreanism"],
        "tags": ["ancient-greek", "mathematics", "cosmology"],
        "blurb": "Pre-Socratic philosopher (c.570-495 BCE), founder of the Pythagorean brotherhood.",
    },
    "Abraham Abulafia": {
        "type": "thinker", "id": "thinker_abulafia",
        "aliases": ["Abulafia"],
        "tags": ["kabbalah", "jewish", "13th-century", "prophetic-kabbalah"],
        "blurb": "Spanish-Jewish Kabbalist (1240-c.1291), founder of prophetic/ecstatic Kabbalah.",
    },
    "al-Buni": {
        "type": "thinker", "id": "thinker_albuni",
        "aliases": ["al-Buni", "Ahmad al-Buni", "Buni"],
        "tags": ["islamic", "magic", "letter-mysticism"],
        "blurb": "North African Islamic mystic (d. 1225), author of Shams al-Ma'arif.",
    },
    "Albertus Magnus": {
        "type": "thinker", "id": "thinker_albertus",
        "aliases": ["Albert the Great", "Albertus", "Albert Magnus"],
        "tags": ["scholastic", "magic", "natural-philosophy"],
        "blurb": "Dominican friar and polymath (c.1200-1280), wrote on natural magic.",
    },
    "Roger Bacon": {
        "type": "thinker", "id": "thinker_bacon",
        "aliases": ["Roger Bacon", "Friar Bacon"],
        "tags": ["scholastic", "magic", "natural-philosophy"],
        "blurb": "English philosopher and Franciscan friar (c.1214/20-1292).",
    },
    "Athanasius Kircher": {
        "type": "thinker", "id": "thinker_kircher",
        "aliases": ["Kircher"],
        "tags": ["baroque", "encyclopaedist", "hieroglyphs", "jesuit"],
        "blurb": "German Jesuit polymath (1602-1680), wrote on hieroglyphs, music, and cosmology.",
    },
    "Pico": {
        "type": "thinker", "id": "thinker_pico",
        "aliases": [],
        "tags": ["renaissance"],
        "blurb": "",
    },
    # Texts
    "Enneads": {
        "type": "text", "id": "text_enneads",
        "aliases": ["Enneades"],
        "tags": ["neoplatonism", "plotinus", "treatises"],
        "blurb": "Collected works of Plotinus in 6 groups of 9, edited by Porphyry c.301 CE.",
    },
    "Rasa'il": {
        "type": "text", "id": "text_rasail",
        "aliases": ["Rasail", "Epistles of the Brethren of Purity", "Epistles",
                    "Rasa'il Ikhwan al-Safa"],
        "tags": ["islamic", "encyclopaedia", "10th-century"],
        "blurb": "52-epistle encyclopaedia by Ikhwan al-Safa covering mathematics, cosmology, philosophy.",
    },
    "Corpus Hermeticum": {
        "type": "text", "id": "text_corpus_hermeticum",
        "aliases": ["Hermetica", "Hermetic corpus", "Hermetic texts"],
        "tags": ["hermeticism", "greek", "late-antiquity"],
        "blurb": "Collection of Greek Hermetic treatises (2nd-4th century CE), translated by Ficino.",
    },
    "De occulta philosophia": {
        "type": "text", "id": "text_de_occulta",
        "aliases": ["De Occulta Philosophia", "Three Books of Occult Philosophy",
                    "Occult Philosophy"],
        "tags": ["renaissance", "magic", "kabbalah", "agrippa"],
        "blurb": "Three-volume magical encyclopaedia by Agrippa (1531).",
    },
    "Oration on the Dignity of Man": {
        "type": "text", "id": "text_oration",
        "aliases": ["Oratio", "Oration on Dignity", "Dignity of Man",
                    "De dignitate hominis"],
        "tags": ["renaissance", "humanism", "pico"],
        "blurb": "Pico's preface to his 900 Theses (1486), manifesto of Renaissance humanism.",
    },
    "Picatrix": {
        "type": "text", "id": "text_picatrix",
        "aliases": ["Ghayat al-Hakim", "Ghayat"],
        "tags": ["arabic", "magic", "astral-magic"],
        "blurb": "Arabic magical compendium (c.10th cent. CE), translated into Latin in 13th cent.",
    },
    "Sefer Yetzirah": {
        "type": "text", "id": "text_sefer_yetzirah",
        "aliases": ["Book of Formation", "Book of Creation"],
        "tags": ["kabbalah", "jewish", "cosmology"],
        "blurb": "Early Jewish mystical text describing creation through 32 paths of wisdom.",
    },
    "Zohar": {
        "type": "text", "id": "text_zohar",
        "aliases": ["Book of Splendor", "Sefer ha-Zohar"],
        "tags": ["kabbalah", "jewish", "mysticism"],
        "blurb": "Central text of Kabbalah, compiled c.1280 CE in Castile.",
    },
    "Shams al-Ma'arif": {
        "type": "text", "id": "text_shams",
        "aliases": ["Shams al Maarif", "Book of the Sun of Knowledge"],
        "tags": ["islamic", "magic", "al-buni"],
        "blurb": "Major Arabic manual of letter magic and talismans by al-Buni.",
    },
    # Concepts
    "emanation": {
        "type": "concept", "id": "concept_emanation",
        "aliases": ["procession", "emanationism", "emanative"],
        "tags": ["neoplatonism", "cosmology", "ontology"],
        "blurb": "Neoplatonic doctrine that reality flows outward from the One through hypostases.",
    },
    "the One": {
        "type": "concept", "id": "concept_the_one",
        "aliases": ["hen", "the Good", "the First Principle"],
        "tags": ["neoplatonism", "theology", "plotinus"],
        "blurb": "The first principle in Neoplatonic metaphysics: absolutely simple, beyond being.",
    },
    "Neoplatonism": {
        "type": "concept", "id": "concept_neoplatonism",
        "aliases": ["Neoplatonist", "Neoplatonic", "neo-Platonic"],
        "tags": ["philosophy", "late-antiquity", "renaissance"],
        "blurb": "Philosophical tradition from Plotinus (c.250 CE) synthesising Plato with eastern thought.",
    },
    "theurgy": {
        "type": "concept", "id": "concept_theurgy",
        "aliases": ["theurgic", "theurgist"],
        "tags": ["neoplatonism", "ritual-magic", "iamblichus"],
        "blurb": "Ritual practice aimed at drawing divine power into the soul; theorised by Iamblichus.",
    },
    "kabbalah": {
        "type": "concept", "id": "concept_kabbalah",
        "aliases": ["Kabbalah", "Kabbalism", "Kabbalistic", "Jewish mysticism",
                    "kabbalist", "kabbalists"],
        "tags": ["jewish", "mysticism", "tree-of-life"],
        "blurb": "Jewish esoteric tradition interpreting Torah through ten sefirot.",
    },
    "alchemy": {
        "type": "concept", "id": "concept_alchemy",
        "aliases": ["alchemical", "alchemist", "alchemists", "alchemica"],
        "tags": ["natural-philosophy", "transmutation", "hermetic"],
        "blurb": "Pre-modern philosophical and proto-scientific tradition of transformation.",
    },
    "astral magic": {
        "type": "concept", "id": "concept_astral_magic",
        "aliases": ["talismanic magic", "astrological magic", "talismans",
                    "talisman", "talismanic"],
        "tags": ["magic", "astrology", "planets"],
        "blurb": "Ritual practice drawing on planetary powers through images and timings.",
    },
    "world soul": {
        "type": "concept", "id": "concept_world_soul",
        "aliases": ["anima mundi", "world-soul"],
        "tags": ["neoplatonism", "cosmology", "magic"],
        "blurb": "Neoplatonic hypostasis between Intellect and Matter; animates the cosmos.",
    },
    "prisca theologia": {
        "type": "concept", "id": "concept_prisca_theologia",
        "aliases": ["philosophia perennis", "perennial philosophy", "ancient theology",
                    "prisca", "perennial"],
        "tags": ["renaissance", "syncretism", "ficino"],
        "blurb": "Renaissance idea of a single primordial theology underlying all ancient wisdom.",
    },
    "Renaissance magic": {
        "type": "concept", "id": "concept_renaissance_magic",
        "aliases": ["natural magic", "Renaissance occultism", "learned magic"],
        "tags": ["renaissance", "magic", "natural-philosophy"],
        "blurb": "Learned magical practice of the 15th-17th centuries.",
    },
    "memory palace": {
        "type": "concept", "id": "concept_memory_palace",
        "aliases": ["art of memory", "memory theatre", "ars memorativa",
                    "method of loci"],
        "tags": ["renaissance", "mnemotechnics", "bruno"],
        "blurb": "Mnemonic technique placing mental images in imagined architectural spaces.",
    },
    "magic squares": {
        "type": "concept", "id": "concept_magic_squares",
        "aliases": ["magic square", "numerical square", "wafq"],
        "tags": ["islamic", "numerology", "al-buni"],
        "blurb": "Squares of numbers with equal row/column/diagonal sums; used in Islamic talismanic magic.",
    },
    "Kabbalah": {
        "type": "concept", "id": "concept_kabbalah",
        "aliases": [],
        "tags": [],
        "blurb": "",
    },
}

# Deduplicate ENTITY_DICT — remove entries that map to same id as earlier entry
_seen_ids: set = set()
_deduped: dict = {}
for _label, _info in ENTITY_DICT.items():
    if _info["id"] not in _seen_ids:
        _seen_ids.add(_info["id"])
        _deduped[_label] = _info
ENTITY_DICT = _deduped


def _build_keyword_map() -> dict[str, str]:
    kw: dict[str, str] = {}
    for label, info in ENTITY_DICT.items():
        eid = info["id"]
        aliases = info.get("aliases", [])
        # Ensure aliases is a list for the + operator
        if not isinstance(aliases, list):
            aliases = []
        for term in [label] + aliases:
            kw[term.lower()] = eid
    return kw

KEYWORD_MAP = _build_keyword_map()

# ---------------------------------------------------------------------------
# Request type patterns
# ---------------------------------------------------------------------------
REQUEST_PATTERNS = {
    "table":         r"\b(table|tabular|tabulate|spreadsheet|columns?)\b",
    "list":          r"\b(list|enumerate|give me \d+|bullet.?point|points? to)\b",
    "summary":       r"\b(summar[iy]|overview|outline|precis|synopsis|summarize)\b",
    "analysis":      r"\b(anal[yz]|examine|breakdown|dissect|discuss|explore)\b",
    "comparison":    r"\b(compar|contrast|differ|versus|vs\.?|parallel)\b",
    "translation":   r"\b(translat|render into|in english|in latin|in arabic)\b",
    "close-reading": r"\b(close.?read|passage|quote|excerpt|paragraph|section)\b",
    "bibliography":  r"\b(bibliograph|reference|source|citation|footnote|further reading)\b",
    "refinement":    r"\b(refine|improve|expand|add|more detail|elaborate|extend)\b",
    "explanation":   r"\b(explain|what (is|are|was|were)|define|meaning of|how does)\b",
    "timeline":      r"\b(timeline|chronolog|when did|date|period|century)\b",
    "methodology":   r"\b(method|approach|technique|how (to|would|can i)|pipeline|workflow)\b",
    "python":        r"\b(python|script|code|function|sqlite|pandas|jupyter|notebook)\b",
    "visualisation": r"\b(visuali[sz]|graph|chart|diagram|map|network|plot)\b",
}

def classify_request(text: str) -> list[str]:
    t = text.lower()
    types = [rt for rt, pat in REQUEST_PATTERNS.items() if re.search(pat, t)]
    return types or ["other"]


# ---------------------------------------------------------------------------
# HTML parser  (handles the flat Format B structure)
# ---------------------------------------------------------------------------
_STRIP_TAGS = re.compile(r"<[^>]+>")

def _strip_html(text: str) -> str:
    text = html_lib.unescape(text)
    text = _STRIP_TAGS.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


class ChatHTMLParser(HTMLParser):
    """
    Parses Format B ChatGPT HTML exports.

    Structure:
      <h1>TITLE</h1>
      <div class="meta">DATE ...</div>
      <div class="msg user"><div class="role user">You</div>TEXT...</div>
      <div class="msg assistant"><div class="role ...">ChatGPT</div>HTML...</div>

    Key insight: no nested divs inside message content (PDF embeds are in .msg.tool).
    We track div depth with a simple integer counter.
    """

    def __init__(self):
        super().__init__()
        self.title: str = ""
        self.meta_str: str = ""
        self.turns: list[dict] = []

        self._div_depth: int = 0            # overall <div> nesting counter

        # h1 / meta
        self._in_h1: bool = False
        self._in_meta: bool = False
        self._meta_div_depth: int = -1

        # current message state
        self._msg_role: str | None = None
        self._msg_div_depth: int = -1       # depth at which msg div opened

        # role sub-div inside msg
        self._in_role_div: bool = False
        self._role_div_depth: int = -1

        # content accumulation
        self._collecting: bool = False
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get("class", "")
        classes = cls.split()

        if tag == "h1":
            self._in_h1 = True
            return

        if tag == "div":
            self._div_depth += 1

            if "meta" in classes and self._msg_role is None:
                self._in_meta = True
                self._meta_div_depth = self._div_depth
                return

            if "msg" in classes:
                # role is the OTHER class alongside "msg"
                role = next((c for c in classes if c != "msg"), "unknown")
                self._msg_role = role
                self._msg_div_depth = self._div_depth
                self._parts = []
                self._collecting = False
                return

            if self._msg_role is not None and "role" in classes:
                # The inner role label div — skip its text
                self._in_role_div = True
                self._role_div_depth = self._div_depth
                return

        # Any other tag inside an active message (after role div) → start collecting
        if self._msg_role and not self._in_role_div and self._msg_div_depth >= 0:
            self._collecting = True

    def handle_endtag(self, tag: str):
        if tag == "h1":
            self._in_h1 = False
            return

        if tag == "div":
            if self._in_meta and self._div_depth == self._meta_div_depth:
                self._in_meta = False
                self._meta_div_depth = -1
                self._div_depth -= 1
                return

            if self._in_role_div and self._div_depth == self._role_div_depth:
                self._in_role_div = False
                self._role_div_depth = -1
                # After role div closes, we start collecting
                self._collecting = True
                self._div_depth -= 1
                return

            if self._msg_role and self._div_depth == self._msg_div_depth:
                # Message div closed — commit turn
                content = _strip_html(" ".join(self._parts))
                self.turns.append({"role": self._msg_role, "content": content})
                self._msg_role = None
                self._msg_div_depth = -1
                self._collecting = False
                self._parts = []
                self._div_depth -= 1
                return

            self._div_depth -= 1

    def handle_data(self, data: str):
        if self._in_h1:
            self.title += data
        elif self._in_meta and not self._in_role_div:
            self.meta_str += data
        elif self._collecting and self._msg_role and not self._in_role_div:
            self._parts.append(data)

    def handle_entityref(self, name: str):
        if self._collecting and not self._in_role_div:
            self._parts.append(html_lib.unescape(f"&{name};"))

    def handle_charref(self, name: str):
        if self._collecting and not self._in_role_div:
            self._parts.append(html_lib.unescape(f"&#{name};"))

    def parse_meta(self) -> tuple[str | None, str | None, int | None]:
        meta = self.meta_str.strip()
        date_str = None
        model = None
        msg_count = None

        # "Created: November 11, 2024 01:28 PM"
        dm = re.search(r"(?:Created:|Updated:)?\s*(\w+ \d{1,2},\s*\d{4}(?:\s+\d{1,2}:\d{2}\s*[AP]M)?)", meta)
        if dm:
            raw = dm.group(1).strip()
            for fmt in ("%B %d, %Y %I:%M %p", "%B %d, %Y"):
                try:
                    date_str = datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
                    break
                except ValueError:
                    pass

        mm = re.search(r"Model:\s*([^\s·\n]+)", meta)
        if mm:
            model = mm.group(1).strip()

        cm = re.search(r"(\d+)\s+messages?", meta)
        if cm:
            msg_count = int(cm.group(1))

        return date_str, model, msg_count


def parse_html_file(path: Path) -> dict | None:
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            html = f.read()
    except Exception as e:
        print(f"  [WARN] Cannot read {path.name}: {e}", file=sys.stderr)
        return None

    parser = ChatHTMLParser()
    try:
        parser.feed(html)
    except Exception as e:
        print(f"  [WARN] Parse error in {path.name}: {e}", file=sys.stderr)
        return None

    date_str, model, msg_count = parser.parse_meta()
    return {
        "title":          parser.title.strip() or path.stem,
        "date":           date_str,
        "model":          model,
        "msg_count_meta": msg_count,
        "turns":          parser.turns,
        "filename":       path.name,
        "filepath":       str(path),
    }


# ---------------------------------------------------------------------------
# Entity mention extraction
# ---------------------------------------------------------------------------
def extract_mentions(text: str) -> list[str]:
    text_lower = text.lower()
    seen: set[str] = set()
    found: list[str] = []
    for kw, eid in sorted(KEYWORD_MAP.items(), key=lambda x: -len(x[0])):
        # Use word boundaries to avoid e.g. "dee" matching "indeed"
        if re.search(r"\b" + re.escape(kw) + r"\b", text_lower) and eid not in seen:
            seen.add(eid)
            found.append(eid)
    return found


# ---------------------------------------------------------------------------
# SQLite schema
# ---------------------------------------------------------------------------
SCHEMA_SQL = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- Core Mining Tables
CREATE TABLE IF NOT EXISTS conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    filename    TEXT    NOT NULL UNIQUE,
    filepath    TEXT    NOT NULL,
    title       TEXT,
    date        TEXT,
    model       TEXT,
    msg_count   INTEGER,
    turn_count  INTEGER,
    imported_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS turns (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    turn_index      INTEGER NOT NULL,
    role            TEXT    NOT NULL,
    content         TEXT,
    word_count      INTEGER,
    request_types   TEXT,
    entity_ids      TEXT
);

CREATE TABLE IF NOT EXISTS entity_mentions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    turn_id         INTEGER NOT NULL REFERENCES turns(id),
    entity_id       TEXT    NOT NULL,
    role            TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS request_types (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    turn_id         INTEGER NOT NULL REFERENCES turns(id),
    request_type    TEXT    NOT NULL
);

-- EsoPipe 2.0: Embedding Infrastructure
CREATE TABLE IF NOT EXISTS embedding_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL, 
    model_version TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    normalized BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS object_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES embedding_runs(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL, -- 'turn', 'table', 'entity'
    object_id TEXT NOT NULL,   -- turn_id, entity_id, or table_id
    content_hash TEXT, 
    embedding BLOB NOT NULL,
    UNIQUE(run_id, object_type, object_id)
);

CREATE TABLE IF NOT EXISTS scholarly_tables (
    id TEXT PRIMARY KEY,
    template TEXT,
    title TEXT,
    description TEXT,
    user_request TEXT,
    payload_json TEXT NOT NULL, -- The full JSON structure for the frontend
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    blurb TEXT,
    metadata_json TEXT -- aliases, tags, etc.
);

-- EsoPipe 2.0: Intent Evaluation
CREATE TABLE IF NOT EXISTS intent_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    turn_id INTEGER NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
    intent_key TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    is_gold_standard BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- EsoPipe 2.0: Artifact Registry & Provenance
CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY, 
    type TEXT NOT NULL, 
    schema_version TEXT NOT NULL,
    payload_json TEXT NOT NULL, 
    payload_markdown TEXT,      
    context_snapshot_json TEXT, 
    revision_number INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artifact_sources (
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL, 
    source_id TEXT NOT NULL,   
    weight REAL DEFAULT 1.0,
    PRIMARY KEY (artifact_id, source_type, source_id)
);

-- EsoPipe 2.0: FTS5 for Hybrid Retrieval (External Content)
CREATE VIRTUAL TABLE IF NOT EXISTS turns_fts USING fts5(
    content,
    content='turns',
    content_rowid='id'
);

CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
    label, blurb, metadata_json,
    content='entities',
    content_rowid='rowid',
    tokenize='unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS tables_fts USING fts5(
    title, description, user_request,
    content='scholarly_tables',
    content_rowid='rowid',
    tokenize='unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS turns_ai AFTER INSERT ON turns BEGIN
  INSERT INTO turns_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS turns_ad AFTER DELETE ON turns BEGIN
  INSERT INTO turns_fts(turns_fts, rowid, content) VALUES('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS turns_au AFTER UPDATE ON turns BEGIN
  INSERT INTO turns_fts(turns_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO turns_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts(rowid, label, blurb, metadata_json) VALUES (new.rowid, new.label, new.blurb, new.metadata_json);
END;
CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, label, blurb, metadata_json) VALUES('delete', old.rowid, old.label, old.blurb, old.metadata_json);
END;
CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, label, blurb, metadata_json) VALUES('delete', old.rowid, old.label, old.blurb, old.metadata_json);
  INSERT INTO entities_fts(rowid, label, blurb, metadata_json) VALUES (new.rowid, new.label, new.blurb, new.metadata_json);
END;

CREATE INDEX IF NOT EXISTS idx_turns_conv   ON turns(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mentions_eid ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_req_type     ON request_types(request_type);
CREATE INDEX IF NOT EXISTS idx_conv_date    ON conversations(date);
CREATE INDEX IF NOT EXISTS idx_prompt_embed_obj ON object_embeddings(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_intent_labels_turn ON intent_labels(turn_id);
"""


def init_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.executescript(SCHEMA_SQL)
    populate_entities(conn)
    conn.commit()
    return conn

def populate_entities(conn: sqlite3.Connection):
    for label, info in ENTITY_DICT.items():
        eid = info["id"]
        meta = {
            "aliases": info.get("aliases", []),
            "tags": info.get("tags", [])
        }
        conn.execute("""
            INSERT OR REPLACE INTO entities (id, type, label, blurb, metadata_json)
            VALUES (?, ?, ?, ?, ?)
        """, (eid, info["type"], label, info.get("blurb", ""), json.dumps(meta)))


def file_already_imported(conn: sqlite3.Connection, filename: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM conversations WHERE filename=?", (filename,)
    ).fetchone() is not None


def insert_conversation(conn: sqlite3.Connection, data: dict) -> int:
    cur = conn.execute(
        """INSERT INTO conversations
           (filename,filepath,title,date,model,msg_count,turn_count,imported_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        (data["filename"], data["filepath"], data["title"], data["date"],
         data["model"], data["msg_count_meta"], len(data["turns"]),
         datetime.now().isoformat()),
    )
    return cur.lastrowid


def insert_turns(conn: sqlite3.Connection, conv_id: int, turns: list[dict]):
    for i, turn in enumerate(turns):
        content    = turn["content"] or ""
        word_count = len(content.split())
        entity_ids = extract_mentions(content)
        req_types  = classify_request(content) if turn["role"] == "user" else []

        cur = conn.execute(
            """INSERT INTO turns
               (conversation_id,turn_index,role,content,word_count,request_types,entity_ids)
               VALUES (?,?,?,?,?,?,?)""",
            (conv_id, i, turn["role"], content, word_count,
             json.dumps(req_types), json.dumps(entity_ids)),
        )
        turn_id = cur.lastrowid

        for eid in entity_ids:
            conn.execute(
                "INSERT INTO entity_mentions (conversation_id,turn_id,entity_id,role) VALUES (?,?,?,?)",
                (conv_id, turn_id, eid, turn["role"]),
            )
        for rt in req_types:
            conn.execute(
                "INSERT INTO request_types (conversation_id,turn_id,request_type) VALUES (?,?,?)",
                (conv_id, turn_id, rt),
            )


# ---------------------------------------------------------------------------
# Analysis helpers
# ---------------------------------------------------------------------------
def eid_to_label(eid: str) -> str:
    return next((lbl for lbl, d in ENTITY_DICT.items() if d["id"] == eid), eid)

def eid_to_info(eid: str) -> dict:
    return next((d for d in ENTITY_DICT.values() if d["id"] == eid), {})


# ---------------------------------------------------------------------------
# Plain-text report
# ---------------------------------------------------------------------------
def generate_report(conn: sqlite3.Connection) -> str:
    lines = []
    hr = "=" * 70
    lines += [hr, "ESOTERIC CHAT ARCHIVE -- MINING REPORT",
              f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", hr, ""]

    n_convs = conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]
    n_turns = conn.execute("SELECT COUNT(*) FROM turns").fetchone()[0]
    n_user  = conn.execute("SELECT COUNT(*) FROM turns WHERE role='user'").fetchone()[0]
    n_asst  = conn.execute("SELECT COUNT(*) FROM turns WHERE role='assistant'").fetchone()[0]
    words   = conn.execute("SELECT SUM(word_count) FROM turns WHERE role='assistant'").fetchone()[0] or 0
    dates   = conn.execute("SELECT MIN(date),MAX(date) FROM conversations WHERE date IS NOT NULL").fetchone()

    lines += [
        "OVERVIEW", "-"*40,
        f"  Conversations : {n_convs}",
        f"  Total turns   : {n_turns}  (user: {n_user}  assistant: {n_asst})",
        f"  Words (AI)    : {words:,}",
    ]
    if dates[0]:
        lines.append(f"  Date range    : {dates[0]}  to  {dates[1]}")
    lines.append("")

    top_ents = conn.execute("""
        SELECT entity_id, COUNT(*) cnt FROM entity_mentions
        GROUP BY entity_id ORDER BY cnt DESC LIMIT 30
    """).fetchall()
    lines += ["TOP MENTIONED ENTITIES", "-"*40]
    for eid, cnt in top_ents:
        lines.append(f"  {eid_to_label(eid):45} {cnt:>4}")
    lines.append("")

    req = conn.execute("""
        SELECT request_type, COUNT(*) cnt FROM request_types
        GROUP BY request_type ORDER BY cnt DESC
    """).fetchall()
    lines += ["USER REQUEST TYPES", "-"*40]
    for rt, cnt in req:
        lines.append(f"  {rt:25} {cnt:>4}")
    lines.append("")

    rich = conn.execute("""
        SELECT c.title, c.date, COUNT(DISTINCT em.entity_id) ue, COUNT(em.id) tm
        FROM conversations c JOIN entity_mentions em ON em.conversation_id=c.id
        GROUP BY c.id ORDER BY ue DESC LIMIT 15
    """).fetchall()
    lines += ["MOST ENTITY-RICH CONVERSATIONS", "-"*40]
    for title, date, ue, tm in rich:
        lines.append(f"  [{date or '?':10}] {(title or '?')[:48]:50} {ue} entities")
    lines.append("")

    lines.append(hr)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Topic catalog  (attractive HTML)
# ---------------------------------------------------------------------------
CATALOG_CSS = """
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Georgia', serif;
    background: #1a160e;
    color: #e8dfc8;
    line-height: 1.7;
    padding: 2rem 1rem 6rem;
}
h1.site-title {
    text-align: center;
    font-size: 2rem;
    color: #d4a843;
    letter-spacing: .06em;
    margin-bottom: .3rem;
}
.subtitle {
    text-align: center;
    color: #9a8a6a;
    font-size: .9rem;
    margin-bottom: 3rem;
    font-style: italic;
}
.stats-bar {
    display: flex;
    justify-content: center;
    gap: 3rem;
    margin-bottom: 3rem;
    flex-wrap: wrap;
}
.stat {
    text-align: center;
}
.stat .num {
    font-size: 2.4rem;
    font-weight: 700;
    color: #d4a843;
    display: block;
    font-family: 'Georgia', serif;
}
.stat .lbl {
    font-size: .8rem;
    color: #9a8a6a;
    text-transform: uppercase;
    letter-spacing: .08em;
}
section.category {
    max-width: 1100px;
    margin: 0 auto 3rem;
}
section.category h2 {
    font-size: 1.3rem;
    color: #d4a843;
    border-bottom: 1px solid #3a3020;
    padding-bottom: .4rem;
    margin-bottom: 1.2rem;
    letter-spacing: .04em;
}
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
}
.card {
    background: #252015;
    border: 1px solid #3a3020;
    border-radius: 8px;
    padding: 1.1rem 1.3rem;
    transition: border-color .2s;
}
.card:hover { border-color: #d4a843; }
.card-label {
    font-size: 1.05rem;
    font-weight: 700;
    color: #e8dfc8;
    margin-bottom: .3rem;
}
.card-type {
    font-size: .72rem;
    text-transform: uppercase;
    letter-spacing: .08em;
    color: #6a5a3a;
    margin-bottom: .5rem;
}
.card-blurb {
    font-size: .85rem;
    color: #b0a080;
    margin-bottom: .8rem;
    line-height: 1.5;
}
.card-stats {
    display: flex;
    gap: 1rem;
    font-size: .8rem;
    color: #9a8a6a;
}
.card-stats strong { color: #d4a843; }
.tags {
    margin-top: .6rem;
    display: flex;
    flex-wrap: wrap;
    gap: .3rem;
}
.tag {
    background: #1a1408;
    border: 1px solid #3a3020;
    border-radius: 4px;
    padding: .1rem .45rem;
    font-size: .72rem;
    color: #7a6a4a;
}
.request-section {
    max-width: 1100px;
    margin: 0 auto 3rem;
}
.request-section h2 {
    font-size: 1.3rem;
    color: #d4a843;
    border-bottom: 1px solid #3a3020;
    padding-bottom: .4rem;
    margin-bottom: 1.2rem;
}
.req-bars { display: flex; flex-direction: column; gap: .5rem; }
.req-row { display: flex; align-items: center; gap: .8rem; }
.req-label { width: 160px; font-size: .88rem; color: #b0a080; text-align: right; }
.req-bar-wrap { flex: 1; background: #1a1408; border-radius: 3px; height: 18px; }
.req-bar { background: #d4a843; border-radius: 3px; height: 18px; }
.req-count { font-size: .8rem; color: #6a5a3a; width: 40px; }
.timeline-section {
    max-width: 1100px;
    margin: 0 auto 3rem;
}
.timeline-section h2 {
    font-size: 1.3rem;
    color: #d4a843;
    border-bottom: 1px solid #3a3020;
    padding-bottom: .4rem;
    margin-bottom: 1.2rem;
}
.year-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: .6rem;
}
.year-cell {
    background: #252015;
    border: 1px solid #3a3020;
    border-radius: 6px;
    padding: .7rem 1rem;
}
.year-cell .yr { font-size: 1.1rem; color: #d4a843; font-weight: 700; }
.year-cell .topics { font-size: .8rem; color: #9a8a6a; margin-top: .2rem; }
.desire-section {
    max-width: 1100px;
    margin: 0 auto 3rem;
}
.desire-section h2 {
    font-size: 1.3rem;
    color: #d4a843;
    border-bottom: 1px solid #3a3020;
    padding-bottom: .4rem;
    margin-bottom: 1.2rem;
}
.desire-table {
    width: 100%;
    border-collapse: collapse;
    font-size: .88rem;
}
.desire-table th {
    text-align: left;
    padding: .4rem .8rem;
    color: #9a8a6a;
    font-weight: 600;
    border-bottom: 1px solid #3a3020;
    font-size: .78rem;
    text-transform: uppercase;
    letter-spacing: .06em;
}
.desire-table td {
    padding: .4rem .8rem;
    border-bottom: 1px solid #1a1408;
    color: #b0a080;
}
.desire-table td:first-child { color: #e8dfc8; }
.desire-table td.cnt { color: #d4a843; font-weight: 700; }
footer {
    text-align: center;
    color: #4a3a2a;
    font-size: .8rem;
    margin-top: 4rem;
}
"""


def generate_catalog(conn: sqlite3.Connection, scan_dir: Path) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    # Basic stats
    n_convs = conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]
    n_turns = conn.execute("SELECT COUNT(*) FROM turns WHERE role='user'").fetchone()[0]
    n_ents  = conn.execute("SELECT COUNT(DISTINCT entity_id) FROM entity_mentions").fetchone()[0]
    words   = conn.execute("SELECT SUM(word_count) FROM turns WHERE role='assistant'").fetchone()[0] or 0
    dates   = conn.execute("SELECT MIN(date),MAX(date) FROM conversations WHERE date IS NOT NULL").fetchone()

    # Entity data with conv counts
    ent_rows = conn.execute("""
        SELECT entity_id,
               COUNT(DISTINCT conversation_id) conv_count,
               COUNT(*) total_mentions
        FROM entity_mentions
        GROUP BY entity_id
        HAVING conv_count >= 2
        ORDER BY conv_count DESC
    """).fetchall()

    # Group by entity type
    by_type: dict[str, list] = {}
    for eid, cc, tm in ent_rows:
        info = eid_to_info(eid)
        etype = info.get("type", "concept")
        by_type.setdefault(etype, []).append((eid, cc, tm, info))

    type_order = ["thinker", "text", "concept"]
    type_labels = {"thinker": "Thinkers & Figures",
                   "text":    "Texts & Sources",
                   "concept": "Concepts & Traditions"}

    # Request type data
    req_rows = conn.execute("""
        SELECT request_type, COUNT(*) cnt FROM request_types
        GROUP BY request_type ORDER BY cnt DESC
    """).fetchall()
    max_req = req_rows[0][1] if req_rows else 1

    # Timeline: top entity per year
    year_rows = conn.execute("""
        SELECT substr(c.date,1,4) yr, em.entity_id, COUNT(*) cnt
        FROM conversations c JOIN entity_mentions em ON em.conversation_id=c.id
        WHERE c.date IS NOT NULL
        GROUP BY yr, em.entity_id ORDER BY yr, cnt DESC
    """).fetchall()
    from itertools import groupby
    year_data = []
    for yr, rows in groupby(year_rows, key=lambda r: r[0]):
        rows_list = list(rows)
        top3 = rows_list[:3]
        year_data.append((yr, [(eid_to_label(r[1]), r[2]) for r in top3]))

    # Scholarly desires
    desire_rows = conn.execute("""
        SELECT em.entity_id, rt.request_type, COUNT(*) cnt
        FROM entity_mentions em
        JOIN request_types rt ON rt.turn_id=em.turn_id
        WHERE em.role='user'
        GROUP BY em.entity_id, rt.request_type
        ORDER BY cnt DESC LIMIT 40
    """).fetchall()

    # ── Build HTML ──────────────────────────────────────────────────────────
    H = []
    H.append(f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Esoteric Studies Catalog</title>
<style>{CATALOG_CSS}</style>
</head>
<body>
<h1 class="site-title">Esoteric Studies — Topic Catalog</h1>
<p class="subtitle">Auto-generated from {n_convs} ChatGPT conversations &bull; {now}</p>

<div class="stats-bar">
  <div class="stat"><span class="num">{n_convs}</span><span class="lbl">Conversations</span></div>
  <div class="stat"><span class="num">{n_turns}</span><span class="lbl">Questions Asked</span></div>
  <div class="stat"><span class="num">{n_ents}</span><span class="lbl">Topics Tracked</span></div>
  <div class="stat"><span class="num">{words//1000}k</span><span class="lbl">Words of AI Text</span></div>
  <div class="stat"><span class="num">{(dates[0] or '?')[:7]}</span><span class="lbl">First Chat</span></div>
</div>
""")

    # Entity sections
    for etype in type_order:
        items = by_type.get(etype, [])
        if not items:
            continue
        label = type_labels.get(etype, etype.title())
        H.append(f'<section class="category">\n<h2>{label}</h2>\n<div class="cards">')
        for eid, cc, tm, info in items[:30]:
            lbl   = eid_to_label(eid)
            blurb = info.get("blurb", "")
            tags  = info.get("tags", [])
            tags_html = "".join(f'<span class="tag">{t}</span>' for t in tags[:6])
            H.append(f"""  <div class="card">
    <div class="card-label">{lbl}</div>
    <div class="card-type">{etype}</div>
    <div class="card-blurb">{blurb}</div>
    <div class="card-stats"><span><strong>{cc}</strong> conversations</span><span><strong>{tm}</strong> mentions</span></div>
    <div class="tags">{tags_html}</div>
  </div>""")
        H.append("</div></section>")

    # Request type bar chart
    H.append('<div class="request-section">\n<h2>How You Like to Learn</h2>\n<div class="req-bars">')
    for rt, cnt in req_rows[:14]:
        pct = int(cnt / max_req * 100)
        H.append(f"""  <div class="req-row">
    <div class="req-label">{rt}</div>
    <div class="req-bar-wrap"><div class="req-bar" style="width:{pct}%"></div></div>
    <div class="req-count">{cnt}</div>
  </div>""")
    H.append("</div></div>")

    # Timeline section
    if year_data:
        H.append('<div class="timeline-section">\n<h2>Your Research Through Time</h2>\n<div class="year-grid">')
        for yr, topics in year_data:
            topic_html = ", ".join(f"{lbl} ({cnt})" for lbl, cnt in topics)
            H.append(f"""  <div class="year-cell">
    <div class="yr">{yr}</div>
    <div class="topics">{topic_html}</div>
  </div>""")
        H.append("</div></div>")

    # Scholarly desires table
    H.append("""<div class="desire-section">
<h2>Scholarly Desires (Entity x Request Type)</h2>
<table class="desire-table">
<thead><tr><th>Figure / Text / Concept</th><th>Request Type</th><th>Count</th></tr></thead>
<tbody>""")
    for eid, rt, cnt in desire_rows:
        lbl = eid_to_label(eid)
        H.append(f'  <tr><td>{lbl}</td><td>{rt}</td><td class="cnt">{cnt}</td></tr>')
    H.append("</tbody></table></div>")

    H.append(f'<footer>Generated by mine_chats.py from {scan_dir} &bull; {now}</footer>')
    H.append("</body></html>")

    return "\n".join(H)


# ---------------------------------------------------------------------------
# EsoPipe JSON export
# ---------------------------------------------------------------------------
def export_esopipe_json(conn: sqlite3.Connection, esopipe_dir: Path):
    ent_rows = conn.execute("""
        SELECT entity_id, COUNT(DISTINCT conversation_id) cc
        FROM entity_mentions GROUP BY entity_id HAVING cc >= 2
        ORDER BY cc DESC
    """).fetchall()

    active_ids = {r[0] for r in ent_rows}
    entities = []
    for eid, cc in ent_rows:
        info = eid_to_info(eid)
        if not info:
            continue
        lbl = eid_to_label(eid)
        entities.append({
            "id":      eid,
            "type":    info.get("type", "concept"),
            "label":   lbl,
            "aliases": info.get("aliases", []),
            "blurb":   info.get("blurb", ""),
            "tags":    info.get("tags", []) + [f"in-{cc}-conversations"],
            "links":   [],
        })

    if not active_ids:
        print("  No active entities found — skipping JSON export.")
        return

    placeholders = ",".join("?" * len(active_ids))
    id_list = list(active_ids)
    edges_raw = conn.execute(f"""
        SELECT a.entity_id, b.entity_id, COUNT(DISTINCT a.conversation_id) shared
        FROM entity_mentions a
        JOIN entity_mentions b
          ON a.conversation_id=b.conversation_id AND a.entity_id < b.entity_id
        WHERE a.entity_id IN ({placeholders}) AND b.entity_id IN ({placeholders})
        GROUP BY a.entity_id, b.entity_id HAVING shared >= 2
        ORDER BY shared DESC LIMIT 60
    """, id_list + id_list).fetchall()

    edges = []
    for i, (src, tgt, shared) in enumerate(edges_raw):
        si = eid_to_info(src).get("type", "concept")
        ti = eid_to_info(tgt).get("type", "concept")
        rel = ("mentions" if si == "thinker" and ti == "text" else
               "explains" if si == "text" and ti == "concept" else
               "derived-from" if si == "thinker" and ti == "thinker" else
               "uses")
        edges.append({
            "id": f"mined_e{i:03d}",
            "source": src, "target": tgt, "type": rel,
            "weight": min(3, shared // 3 + 1),
            "notes": f"Co-occurred in {shared} conversations",
        })

    esopipe_dir.mkdir(parents=True, exist_ok=True)
    with open(esopipe_dir / "entities_mined.json", "w", encoding="utf-8") as f:
        json.dump(entities, f, indent=2, ensure_ascii=False)
    with open(esopipe_dir / "edges_mined.json", "w", encoding="utf-8") as f:
        json.dump(edges, f, indent=2, ensure_ascii=False)
    print(f"  Exported {len(entities)} entities -> {esopipe_dir}/entities_mined.json")
    print(f"  Exported {len(edges)} edges    -> {esopipe_dir}/edges_mined.json")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir",          default=".")
    ap.add_argument("--db",           default="esoteric_archive.db")
    ap.add_argument("--esopipe-dir",  default=None)
    ap.add_argument("--report",       default="mine_report.txt")
    ap.add_argument("--catalog",      default="topic_catalog.html")
    ap.add_argument("--force",        action="store_true")
    ap.add_argument("--limit",        type=int, default=None)
    args = ap.parse_args()

    scan_dir    = Path(args.dir).resolve()
    db_path     = Path(args.db).resolve()
    report_path = scan_dir / args.report
    catalog_path = scan_dir / args.catalog

    print(f"\nEsoPipe Chat Miner")
    print(f"  Scanning : {scan_dir}")
    print(f"  Database : {db_path}")

    # Only HTML files (PDFs are redundant duplicates); skip our own generated files
    _skip = {args.catalog, args.report.replace(".txt", ".html"), "topic_catalog.html"}
    html_files = [p for p in sorted(scan_dir.glob("*.html")) if p.name not in _skip]
    if args.limit:
        html_files = html_files[:args.limit]
    print(f"  Found {len(html_files)} HTML files (skipping PDFs)")
    if not html_files:
        print("  Nothing to do.")
        return

    conn = init_db(db_path)
    imported = skipped = errors = 0

    for i, path in enumerate(html_files, 1):
        if not args.force and file_already_imported(conn, path.name):
            skipped += 1
            continue

        print(f"  [{i:3d}/{len(html_files)}] {path.name[:58]:<60}", end=" ", flush=True)
        data = parse_html_file(path)
        if data is None:
            print("FAILED")
            errors += 1
            continue

        try:
            conv_id = insert_conversation(conn, data)
            insert_turns(conn, conv_id, data["turns"])
            conn.commit()
            n = len(data["turns"])
            print(f"OK ({n} turns)")
            imported += 1
        except Exception as e:
            conn.rollback()
            print(f"DB ERROR: {e}")
            errors += 1

    print(f"\n  Imported : {imported}  |  Skipped : {skipped}  |  Errors : {errors}\n")

    # Report
    print("Generating plain-text report...")
    report = generate_report(conn)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"  Saved -> {report_path}")

    # Catalog
    print("Generating topic catalog (HTML)...")
    catalog = generate_catalog(conn, scan_dir)
    with open(catalog_path, "w", encoding="utf-8") as f:
        f.write(catalog)
    print(f"  Saved -> {catalog_path}")
    print(f"  Open topic_catalog.html in your browser to view!")

    # EsoPipe JSON export
    if args.esopipe_dir:
        print(f"\nExporting EsoPipe JSON to {args.esopipe_dir}...")
        export_esopipe_json(conn, Path(args.esopipe_dir).resolve())

    conn.close()

    # Preview report
    print("\n" + "="*50)
    print(report[:2000])


if __name__ == "__main__":
    main()
