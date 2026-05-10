import re
from collections import Counter

import jieba
import jieba.analyse


def normalize_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    normalized = re.sub(r"[ \t]{2,}", " ", normalized)
    return normalized.strip()


def extract_sections(text: str) -> list[dict]:
    lines = [line.strip() for line in text.splitlines()]
    heading_pattern = re.compile(r"^(#{1,6}\s+.+|第[一二三四五六七八九十百千万0-9]+[章节篇]\s*.+|\d+(\.\d+){0,3}\s+.+)$")

    sections = []
    current_title = "导言"
    current_lines = []

    for line in lines:
        if not line:
            continue
        if heading_pattern.match(line):
            if current_lines:
                sections.append({"title": current_title, "text": "\n".join(current_lines)})
                current_lines = []
            current_title = line.lstrip("#").strip()
            continue
        current_lines.append(line)

    if current_lines:
        sections.append({"title": current_title, "text": "\n".join(current_lines)})

    if not sections:
        paragraphs = [paragraph.strip() for paragraph in text.split("\n\n") if paragraph.strip()]
        sections = [{"title": f"片段 {index + 1}", "text": paragraph} for index, paragraph in enumerate(paragraphs)]

    enriched = []
    for index, section in enumerate(sections, start=1):
        enriched.append(
            {
                "index": index,
                "title": section["title"],
                "text": section["text"],
            }
        )
    return enriched


def build_chunks(sections: list[dict], chunk_size: int, overlap: int) -> list[dict]:
    chunks = []
    for section in sections:
        text = section["text"]
        start = 0
        chunk_index = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            snippet = text[start:end].strip()
            if snippet:
                chunks.append(
                    {
                        "chunk_id": f"{section['index']}-{chunk_index}",
                        "section_title": section["title"],
                        "text": snippet,
                    }
                )
            if end == len(text):
                break
            start = max(end - overlap, start + 1)
            chunk_index += 1
    return chunks


def extract_keywords(text: str, top_k: int) -> list[dict]:
    terms = jieba.analyse.textrank(text, topK=top_k, withWeight=True)
    if terms:
        return [{"term": term, "weight": round(weight, 4)} for term, weight in terms]

    counter = Counter(tokenize_for_search(text))
    return [{"term": term, "weight": float(count)} for term, count in counter.most_common(top_k)]


def split_sentences(text: str) -> list[str]:
    return [item.strip() for item in re.split(r"(?<=[。！？!?\n])", text) if item.strip()]


def tokenize_for_search(text: str) -> list[str]:
    tokens = []
    for token in jieba.lcut(text):
        cleaned = token.strip().lower()
        if not cleaned:
            continue
        if re.fullmatch(r"[\W_]+", cleaned):
            continue
        tokens.append(cleaned)
    return tokens
