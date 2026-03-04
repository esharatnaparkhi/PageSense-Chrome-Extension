"""
Content extraction service — layered pipeline:
  1. PDF            → PyMuPDF (fitz)
  2. JATS/XML       → lxml XPath (PMC full-text)
  3. Site-specific  → curated CSS selectors for 15+ research platforms
  4. Readability    → readability-lxml algorithm
  5. Full-page      → fallback for SPAs / thin content
"""
import re
import hashlib
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from readability import Document
import html2text

from app.schemas.schemas import TextChunk


# ── Site-specific CSS selectors ───────────────────────────────────────────────
# Map: hostname-suffix → {section: [css_selectors in priority order]}
# Sections: title, authors, abstract, body — combined in that order.
SITE_RULES: Dict[str, Dict[str, List[str]]] = {
    "arxiv.org": {
        "title":    ["h1.title", ".title"],
        "authors":  [".authors"],
        "abstract": ["blockquote.abstract", ".abstract"],
    },
    "biorxiv.org": {
        "title":    [".highwire-article-title"],
        "authors":  [".highwire-authors"],
        "abstract": [".abstract-content", ".abstract"],
    },
    "medrxiv.org": {
        "title":    [".highwire-article-title"],
        "authors":  [".highwire-authors"],
        "abstract": [".abstract-content", ".abstract"],
    },
    "pubmed.ncbi.nlm.nih.gov": {
        "title":    [".heading-title"],
        "authors":  [".authors-list"],
        "abstract": [".abstract-content"],
    },
    "pmc.ncbi.nlm.nih.gov": {
        "title":    ["h1.content-title", ".content-title"],
        "abstract": [".abstract"],
        "body":     ["article", "#mc_articlebox"],
    },
    "nature.com": {
        "title":    [".c-article-title"],
        "authors":  [".c-article-author-list"],
        "abstract": [".c-article-section__content", "[data-title='Abstract'] p"],
        "body":     [".c-article-body"],
    },
    "sciencedirect.com": {
        "title":    [".title-text"],
        "authors":  [".author-name"],
        "abstract": [".abstract"],
        "body":     ["#body", ".Body"],
    },
    "ieeexplore.ieee.org": {
        "title":    [".document-title"],
        "abstract": [".abstract-text"],
    },
    "dl.acm.org": {
        "title":    [".citation__title"],
        "abstract": [".abstractSection"],
    },
    "semanticscholar.org": {
        "title":    [".paper-detail-title", "[data-test-id='paper-title']"],
        "abstract": [".abstract__text", "[data-test-id='paper-abstract']"],
    },
    "scholar.google.com": {
        "title":    [".gs_rt"],
        "abstract": [".gs_rs"],
    },
    "plos.org": {
        "title":    ["#artTitle"],
        "abstract": [".abstract"],
        "body":     ["#artText"],
    },
    "frontiersin.org": {
        "title":    [".JournalFullTitle"],
        "abstract": [".AbstractSection", ".abstract-sec"],
        "body":     ["article", ".article-section__content"],
    },
    "link.springer.com": {
        "title":    ["h1.c-article-title"],
        "abstract": [".c-article-section__content"],
        "body":     [".c-article-body"],
    },
    "onlinelibrary.wiley.com": {
        "title":    ["h1.citation__title"],
        "abstract": [".article-section__content"],
        "body":     [".article__body"],
    },
    "jstor.org": {
        "title":    [".title-font", "h1"],
        "abstract": [".abstract-group", ".abstract"],
    },
    "ssrn.com": {
        "title":    [".title"],
        "abstract": ["#abstract-content", ".abstract-text"],
    },
    "researchgate.net": {
        "title":    [".research-detail-header-section__title"],
        "abstract": [".research-detail-header-section__abstract"],
    },
}

# Ordered sections for text assembly
_SECTION_ORDER = ["title", "authors", "abstract", "introduction",
                  "methods", "results", "discussion", "conclusion", "body", "references"]

# Standard academic section headings for normalization
_SECTION_HEADINGS = {
    "abstract":     re.compile(r"^abstract\b", re.I),
    "introduction": re.compile(r"^introduction\b", re.I),
    "methods":      re.compile(r"^(methods|methodology|materials and methods|experimental)\b", re.I),
    "results":      re.compile(r"^results\b", re.I),
    "discussion":   re.compile(r"^discussion\b", re.I),
    "conclusion":   re.compile(r"^(conclusions?|concluding remarks)\b", re.I),
    "references":   re.compile(r"^references\b", re.I),
}


class ContentExtractor:
    """
    Layered content extractor for web pages and research PDFs.

    Extraction order per request:
      PDF content-type / .pdf URL  → extract_from_pdf()
      PMC XML content-type         → _extract_jats_xml()
      Known research hostname      → _try_site_specific()  (falls through if thin)
      Readability                  → built-in algorithm
      Full-page fallback           → strips boilerplate from raw HTML
    """

    def __init__(self):
        self.html2text = html2text.HTML2Text()
        self.html2text.ignore_links = False
        self.html2text.ignore_images = True
        self.html2text.body_width = 0

        self.sensitive_patterns = {
            "credit_card": re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"),
            "ssn":         re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
            "email":       re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
        }

    # ── Public entry points ────────────────────────────────────────────────────

    def extract_from_html(
        self,
        html: str,
        url: str,
        include_images: bool = False,
        content_type: str = "text/html",
    ) -> Dict[str, Any]:
        """
        Extract content from HTML (or XML).

        Pipeline:
          1. JATS/XML  → structured section extraction
          2. Site-specific CSS selectors
          3. Readability algorithm
          4. Full-page fallback if text still thin (<1200 chars)
        """
        # 1. JATS/XML (PMC full-text articles)
        if "xml" in content_type:
            return self._extract_jats_xml(html, url)

        hostname = (urlparse(url).hostname or "").removeprefix("www.")

        # 2. Site-specific selectors
        site_key = next((k for k in SITE_RULES if hostname.endswith(k)), None)
        if site_key:
            result = self._try_site_specific(html, url, site_key)
            if result:
                return result

        # 3. Readability
        doc = Document(html)
        title = doc.title()
        summary_html = doc.summary()

        soup = BeautifulSoup(summary_html, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = self._clean_text(self.html2text.handle(str(soup)))

        # 4. Full-page fallback for SPAs / e-commerce / dashboards
        if len(text) < 1200:
            full_soup = BeautifulSoup(html, "lxml")
            for tag in full_soup([
                "script", "style", "noscript", "nav", "footer", "header",
                "aside", "form", "button", "input", "select", "textarea",
            ]):
                tag.decompose()
            text = self._clean_text(self.html2text.handle(str(full_soup)))

        text = self._redact_sensitive(text)
        chunks = self._create_chunks(text, url)
        meta = self._extract_metadata(BeautifulSoup(summary_html, "lxml"), url)
        sections = self._detect_sections(text)

        return {"text": text, "chunks": chunks, "meta": meta, "title": title, "sections": sections}

    def extract_from_pdf(self, pdf_bytes: bytes, url: str) -> Dict[str, Any]:
        """
        Extract text from a PDF using PyMuPDF (fitz).

        Each page is labelled [Page N] so downstream chunking preserves
        rough page-level provenance. Returns the same dict shape as
        extract_from_html() for uniform downstream handling.
        """
        try:
            import fitz  # PyMuPDF
        except ImportError:
            raise RuntimeError(
                "pymupdf is not installed. Add 'pymupdf>=1.24.0' to requirements.txt."
            )

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pdf_meta = doc.metadata or {}
        title = pdf_meta.get("title", "")

        page_texts: List[str] = []
        for page_num, page in enumerate(doc):
            page_text = page.get_text("text")
            if page_text.strip():
                page_texts.append(f"[Page {page_num + 1}]\n{page_text.strip()}")

        doc.close()

        full_text = "\n\n".join(page_texts)
        text = self._clean_text(full_text)
        text = self._redact_sensitive(text)
        chunks = self._create_chunks(text, url)
        sections = self._detect_sections(text)

        return {
            "text": text,
            "chunks": chunks,
            "meta": {
                "url": url,
                "word_count": len(text.split()),
                "headings": [],
                "links": [],
                "source_type": "pdf",
            },
            "title": title,
            "sections": sections,
        }

    # ── Private extraction helpers ─────────────────────────────────────────────

    def _try_site_specific(
        self, html: str, url: str, site_key: str
    ) -> Optional[Dict[str, Any]]:
        """
        Apply curated CSS selectors for a known research platform.
        Returns None if combined text is below 300 chars (triggers fallback).
        """
        rules = SITE_RULES[site_key]
        soup = BeautifulSoup(html, "lxml")
        parts: Dict[str, str] = {}

        for section, selectors in rules.items():
            for selector in selectors:
                el = soup.select_one(selector)
                if el:
                    parts[section] = el.get_text(separator=" ", strip=True)
                    break

        text_parts = [parts[k] for k in _SECTION_ORDER if k in parts and parts[k]]
        combined = "\n\n".join(text_parts)

        if len(combined) < 300:
            return None

        title = parts.get("title", "")
        if not title:
            try:
                title = Document(html).title()
            except Exception:
                pass

        text = self._clean_text(combined)
        text = self._redact_sensitive(text)
        chunks = self._create_chunks(text, url)
        meta = self._extract_metadata(soup, url)
        meta["extraction_method"] = f"site_specific:{site_key}"

        return {
            "text": text,
            "chunks": chunks,
            "meta": meta,
            "title": title,
            "sections": {k: v for k, v in parts.items() if k != "body"},
        }

    def _extract_jats_xml(self, xml_content: str, url: str) -> Dict[str, Any]:
        """
        Parse NLM JATS XML as served by PubMed Central.
        Extracts title, authors, abstract, and full body via XPath.
        Falls back to HTML extraction on parse failure.
        """
        try:
            from lxml import etree
            root = etree.fromstring(xml_content.encode())
        except Exception:
            return self.extract_from_html(xml_content, url, content_type="text/html")

        def _text(xpath: str) -> str:
            nodes = root.xpath(xpath)
            return " ".join("".join(n.itertext()) for n in nodes).strip()

        sections = {
            "title":    _text(".//article-title"),
            "authors":  _text(".//contrib[@contrib-type='author']//name"),
            "abstract": _text(".//abstract"),
            "body":     _text(".//body"),
        }

        title = sections.get("title", "")
        text = self._clean_text(
            "\n\n".join(v for v in sections.values() if v)
        )
        text = self._redact_sensitive(text)
        chunks = self._create_chunks(text, url)

        return {
            "text": text,
            "chunks": chunks,
            "meta": {
                "url": url,
                "word_count": len(text.split()),
                "headings": [],
                "links": [],
                "extraction_method": "jats_xml",
            },
            "title": title,
            "sections": sections,
        }

    # ── Section normalization ──────────────────────────────────────────────────

    def _detect_sections(self, text: str) -> Dict[str, str]:
        """
        Scan plain text for standard academic section headings.
        Returns a dict mapping canonical name → section content.

        Recognized: abstract, introduction, methods, results,
                    discussion, conclusion, references.
        """
        sections: Dict[str, str] = {}
        current_section: Optional[str] = None
        buffer: List[str] = []

        for line in text.split("\n"):
            stripped = line.strip()
            matched = next(
                (name for name, pattern in _SECTION_HEADINGS.items()
                 if pattern.match(stripped)),
                None,
            )
            if matched:
                if current_section and buffer:
                    sections[current_section] = "\n".join(buffer).strip()
                current_section = matched
                buffer = []
            elif current_section:
                buffer.append(line)

        if current_section and buffer:
            sections[current_section] = "\n".join(buffer).strip()

        return sections

    # ── Shared utilities ───────────────────────────────────────────────────────

    def _clean_text(self, text: str) -> str:
        text = re.sub(r"\n\s*\n", "\n\n", text)
        text = re.sub(r" +", " ", text)
        return text.strip()

    def _redact_sensitive(self, text: str) -> str:
        for pattern_name, pattern in self.sensitive_patterns.items():
            text = pattern.sub(f"[REDACTED_{pattern_name.upper()}]", text)
        return text

    def _create_chunks(
        self,
        text: str,
        url: str,
        chunk_size: int = 1500,
        overlap: int = 200,
    ) -> List[TextChunk]:
        """Split text into overlapping chunks, breaking at sentence boundaries."""
        chunks: List[TextChunk] = []
        text_length = len(text)
        start = 0
        chunk_index = 0

        while start < text_length:
            end = min(start + chunk_size, text_length)

            if end < text_length:
                for i in range(end, max(start + chunk_size - 200, start), -1):
                    if text[i] in ".!?":
                        end = i + 1
                        break

            chunk_text = text[start:end].strip()
            if chunk_text:
                chunk_id = hashlib.md5(
                    f"{url}:{chunk_index}".encode()
                ).hexdigest()[:16]
                chunks.append(TextChunk(
                    id=chunk_id,
                    text=chunk_text,
                    start_char=start,
                    end_char=end,
                    dom_selector=None,
                    source_url=url,
                ))
                chunk_index += 1

            start = end - overlap if end < text_length else end

        return chunks

    def _extract_metadata(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        meta: Dict[str, Any] = {"url": url, "word_count": 0, "headings": [], "links": []}
        meta["word_count"] = len(soup.get_text().split())

        for heading in soup.find_all(["h1", "h2", "h3"]):
            meta["headings"].append({
                "level": heading.name,
                "text": heading.get_text().strip(),
            })

        for link in soup.find_all("a", href=True)[:20]:
            meta["links"].append({
                "text": link.get_text().strip(),
                "href": link["href"],
            })

        return meta

    def detect_sensitive_inputs(self, html: str) -> List[str]:
        """Detect sensitive input fields in HTML."""
        soup = BeautifulSoup(html, "lxml")
        sensitive_fields: List[str] = []

        for _ in soup.find_all("input", type="password"):
            sensitive_fields.append("password")

        for input_tag in soup.find_all("input"):
            name = (input_tag.get("name", "") + " " + input_tag.get("id", "")).lower()
            if any(kw in name for kw in ["card", "cvv", "ccv", "credit"]):
                sensitive_fields.append("credit_card")

        return list(set(sensitive_fields))
