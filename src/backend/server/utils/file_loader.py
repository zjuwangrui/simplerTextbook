import re
from pathlib import Path

from docx import Document
from pypdf import PdfReader

from ..core.errors import AppError

SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf", ".docx"}

CHAPTER_LEVEL_PATTERNS = [
    re.compile(r"^第[一二三四五六七八九十百千0-9]+章[^\n]{0,80}$"),
    re.compile(r"^第[一二三四五六七八九十百千0-9]+篇[^\n]{0,80}$"),
    re.compile(r"^#\s+.+$"),
]

SECTION_LEVEL_PATTERNS = [
    re.compile(r"^第[一二三四五六七八九十百千0-9]+节[^\n]{0,80}$"),
    re.compile(r"^##\s+.+$"),
    re.compile(r"^\d+\.\d+(\.\d+){0,2}\s+.+$"),
    re.compile(r"^[一二三四五六七八九十]+、[^\n]{0,80}$"),
    re.compile(r"^[（(][一二三四五六七八九十0-9]+[）)][^\n]{0,80}$"),
]


def parse_document_file(path: Path, title: str, progress_callback) -> dict:
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise AppError("文件格式不支持。", 400, {"path": str(path), "suffix": suffix})

    if suffix == ".pdf":
        return _parse_pdf(path, title, progress_callback)

    if suffix == ".docx":
        return _parse_docx(path, title, progress_callback)

    if suffix in {".txt", ".md"}:
        return _parse_text_file(path, title, progress_callback)

    raise AppError("无法读取指定文件。", 400, {"path": str(path)})


def _parse_pdf(path: Path, title: str, progress_callback) -> dict:
    reader = PdfReader(str(path))
    total_pages = len(reader.pages)
    parser = _DocumentStructureParser(title)
    top_line_counts: dict[str, int] = {}
    bottom_line_counts: dict[str, int] = {}

    progress_callback(
        {
            "phase": "parsing",
            "current_page": 0,
            "total_pages": total_pages,
            "percent": 1,
            "message": "开始逐页解析 PDF。",
        }
    )

    for page_index, page in enumerate(reader.pages, start=1):
        lines = _clean_page_lines(page.extract_text() or "")
        if lines:
            top_line_counts[lines[0]] = top_line_counts.get(lines[0], 0) + 1
            bottom_line_counts[lines[-1]] = bottom_line_counts.get(lines[-1], 0) + 1

        filtered_lines = _strip_repeated_header_footer(lines, top_line_counts, bottom_line_counts, page_index)
        parser.consume_page(filtered_lines, page_index)

        progress_callback(
            {
                "phase": "parsing",
                "current_page": page_index,
                "total_pages": total_pages,
                "percent": int(page_index / max(total_pages, 1) * 100),
                "message": f"已解析第 {page_index}/{total_pages} 页。",
            }
        )

    parsed = parser.finalize(total_pages)
    return {
        "title": title,
        "total_pages": total_pages,
        "total_chars": parsed["total_chars"],
        "chapters": parsed["chapters"],
    }


def _parse_docx(path: Path, title: str, progress_callback) -> dict:
    document = Document(str(path))
    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    parser = _DocumentStructureParser(title)
    total_items = max(len(paragraphs), 1)

    for index, paragraph in enumerate(paragraphs, start=1):
        parser.consume_page([paragraph], 1)
        progress_callback(
            {
                "phase": "parsing",
                "current_page": 1,
                "total_pages": 1,
                "percent": int(index / total_items * 100),
                "message": f"已解析第 {index}/{total_items} 个段落。",
            }
        )

    parsed = parser.finalize(1)
    return {"title": title, "total_pages": 1, "total_chars": parsed["total_chars"], "chapters": parsed["chapters"]}


def _parse_text_file(path: Path, title: str, progress_callback) -> dict:
    raw_text = path.read_text(encoding="utf-8", errors="ignore")
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    parser = _DocumentStructureParser(title)
    total_items = max(len(lines), 1)

    for index, line in enumerate(lines, start=1):
        parser.consume_page([line], 1)
        if index == 1 or index == total_items or index % 40 == 0:
            progress_callback(
                {
                    "phase": "parsing",
                    "current_page": 1,
                    "total_pages": 1,
                    "percent": int(index / total_items * 100),
                    "message": f"已解析第 {index}/{total_items} 行。",
                }
            )

    parsed = parser.finalize(1)
    return {"title": title, "total_pages": 1, "total_chars": parsed["total_chars"], "chapters": parsed["chapters"]}


class _DocumentStructureParser:
    def __init__(self, title: str):
        self.title = title
        self.chapters: list[dict] = []
        self.current_chapter = self._new_chapter(1, title, 1)
        self.current_section = None

    def consume_page(self, lines: list[str], page_number: int) -> None:
        for line in lines:
            heading = _classify_heading(line)
            if heading == "chapter":
                self._start_new_chapter(_normalize_heading(line), page_number)
                continue
            if heading == "section":
                self._start_new_section(_normalize_heading(line), page_number)
                continue

            self.current_chapter["content_lines"].append(line)
            self.current_chapter["page_end"] = page_number

            if self.current_section is not None:
                self.current_section["content_lines"].append(line)
                self.current_section["page_end"] = page_number

    def finalize(self, total_pages: int) -> dict:
        self._flush_current_section()
        if self.current_chapter["content_lines"] or self.current_chapter["sections"]:
            self.chapters.append(self._finalize_chapter(self.current_chapter))

        normalized_chapters = [chapter for chapter in self.chapters if chapter["content"].strip() or chapter["sections"]]
        if not normalized_chapters:
            normalized_chapters = [
                {
                    "chapter_id": "ch_01",
                    "title": self.title,
                    "page_start": 1,
                    "page_end": total_pages or 1,
                    "content": "",
                    "char_count": 0,
                    "sections": [],
                }
            ]

        total_chars = sum(chapter["char_count"] for chapter in normalized_chapters)
        return {"chapters": normalized_chapters, "total_chars": total_chars}

    def _start_new_chapter(self, title: str, page_number: int) -> None:
        self._flush_current_section()
        if self.current_chapter["content_lines"] or self.current_chapter["sections"]:
            self.chapters.append(self._finalize_chapter(self.current_chapter))
        self.current_chapter = self._new_chapter(len(self.chapters) + 1, title, page_number)

    def _start_new_section(self, title: str, page_number: int) -> None:
        self._flush_current_section()
        self.current_section = self._new_section(len(self.current_chapter["sections"]) + 1, title, page_number)

    def _flush_current_section(self) -> None:
        if self.current_section is None:
            return
        section = self._finalize_section(self.current_section)
        if section["content"].strip():
            self.current_chapter["sections"].append(section)
        self.current_section = None

    def _new_chapter(self, sequence: int, title: str, page_start: int) -> dict:
        return {
            "chapter_id": f"ch_{sequence:02d}",
            "title": title,
            "page_start": page_start,
            "page_end": page_start,
            "content_lines": [],
            "sections": [],
        }

    def _new_section(self, sequence: int, title: str, page_start: int) -> dict:
        return {
            "section_id": f"sec_{sequence:02d}",
            "title": title,
            "page_start": page_start,
            "page_end": page_start,
            "content_lines": [],
        }

    def _finalize_chapter(self, chapter: dict) -> dict:
        content = "\n".join(chapter["content_lines"]).strip()
        return {
            "chapter_id": chapter["chapter_id"],
            "title": chapter["title"],
            "page_start": chapter["page_start"],
            "page_end": chapter["page_end"],
            "content": content,
            "char_count": len(content),
            "sections": chapter["sections"],
        }

    def _finalize_section(self, section: dict) -> dict:
        content = "\n".join(section["content_lines"]).strip()
        return {
            "section_id": section["section_id"],
            "title": section["title"],
            "page_start": section["page_start"],
            "page_end": section["page_end"],
            "content": content,
            "char_count": len(content),
        }


def _clean_page_lines(text: str) -> list[str]:
    lines = []
    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        if _looks_like_page_number(line):
            continue
        if _looks_like_table_line(line):
            continue
        lines.append(line)
    return lines


def _strip_repeated_header_footer(
    lines: list[str],
    top_line_counts: dict[str, int],
    bottom_line_counts: dict[str, int],
    page_number: int,
) -> list[str]:
    filtered = list(lines)
    if not filtered:
        return filtered

    if page_number > 2 and len(filtered[0]) <= 40 and top_line_counts.get(filtered[0], 0) >= 3:
        filtered = filtered[1:]
    if filtered and page_number > 2 and len(filtered[-1]) <= 40 and bottom_line_counts.get(filtered[-1], 0) >= 3:
        filtered = filtered[:-1]
    return filtered


def _classify_heading(line: str) -> str | None:
    if len(line) > 90:
        return None
    for pattern in CHAPTER_LEVEL_PATTERNS:
        if pattern.match(line):
            return "chapter"
    for pattern in SECTION_LEVEL_PATTERNS:
        if pattern.match(line):
            return "section"
    return None


def _looks_like_page_number(line: str) -> bool:
    stripped = line.replace("第", "").replace("页", "").replace("/", "").replace("-", "").strip()
    return bool(re.fullmatch(r"[0-9 ]{1,8}", stripped))


def _looks_like_table_line(line: str) -> bool:
    if line.count("|") >= 2 or line.count("\t") >= 2:
        return True
    if len(re.findall(r"\s{3,}", line)) >= 2:
        return True
    punctuation = len(re.findall(r"[\d\W_]", line))
    if punctuation / max(len(line), 1) > 0.65 and len(re.findall(r"[\u4e00-\u9fffA-Za-z]", line)) < 6:
        return True
    return False


def _normalize_heading(line: str) -> str:
    return line.lstrip("#").strip()
