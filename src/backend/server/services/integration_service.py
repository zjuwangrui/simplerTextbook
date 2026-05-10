from collections import Counter

from ..core.errors import AppError
from ..utils.text_processing import split_sentences, tokenize_for_search


class IntegrationService:
    def __init__(self, processing_settings):
        self.processing_settings = processing_settings

    def generate_summary(self, textbooks: list[dict], ratio: float | None = None) -> dict:
        if not textbooks:
            raise AppError("至少需要一本文教材才能生成整合结果。", 400)

        effective_ratio = ratio or self.processing_settings.summary_ratio
        effective_ratio = max(0.1, min(effective_ratio, 0.5))

        sentence_records = self._collect_sentence_records(textbooks)
        if not sentence_records:
            raise AppError("教材文本不足，无法生成整合摘要。", 400)

        total_characters = sum(len(item["text"]) for item in sentence_records)
        target_budget = max(int(total_characters * effective_ratio), 300)

        frequency = Counter()
        for record in sentence_records:
            frequency.update(tokenize_for_search(record["text"]))

        scored_records = []
        for record in sentence_records:
            tokens = tokenize_for_search(record["text"])
            token_score = sum(frequency[token] for token in tokens) / max(len(tokens), 1)
            length_penalty = 1.0 if 18 <= len(record["text"]) <= 120 else 0.85
            score = round(token_score * length_penalty, 4)
            scored_records.append(record | {"score": score})

        selected = []
        consumed = 0
        for record in sorted(scored_records, key=lambda item: item["score"], reverse=True):
            if consumed >= target_budget:
                break
            selected.append(record)
            consumed += len(record["text"])

        selected = sorted(selected, key=lambda item: (item["book_order"], item["section_order"], item["sentence_order"]))
        summary_items = [
            {
                "text": record["text"],
                "source": {
                    "textbook_id": record["textbook_id"],
                    "textbook_title": record["textbook_title"],
                    "section_title": record["section_title"],
                },
            }
            for record in selected
        ]

        summary_text = "\n".join(
            f"{index + 1}. {item['text']} [{item['source']['textbook_title']} / {item['source']['section_title']}]"
            for index, item in enumerate(summary_items)
        )

        return {
            "summary_ratio": effective_ratio,
            "original_characters": total_characters,
            "summary_characters": sum(len(item["text"]) for item in summary_items),
            "summary_text": summary_text,
            "items": summary_items,
        }

    def _collect_sentence_records(self, textbooks: list[dict]) -> list[dict]:
        records = []
        for book_order, textbook in enumerate(textbooks):
            for section_order, section in enumerate(textbook.get("sections", [])):
                sentences = split_sentences(section["text"])
                for sentence_order, sentence in enumerate(sentences):
                    cleaned = sentence.strip()
                    if len(cleaned) < 10:
                        continue
                    records.append(
                        {
                            "textbook_id": textbook["id"],
                            "textbook_title": textbook["title"],
                            "section_title": section["title"],
                            "text": cleaned,
                            "book_order": book_order,
                            "section_order": section_order,
                            "sentence_order": sentence_order,
                        }
                    )
        return records
