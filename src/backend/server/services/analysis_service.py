from ..core.errors import AppError


class AnalysisService:
    def __init__(self, graph_service):
        self.graph_service = graph_service

    def compare_textbooks(self, textbooks: list[dict]) -> dict:
        textbooks = self._ensure_textbooks(textbooks)
        keyword_map = {
            textbook["id"]: [item["term"] for item in textbook["keywords"][:15]]
            for textbook in textbooks
        }

        shared_keywords = self._collect_shared_keywords(textbooks, keyword_map)
        pairwise_similarity = self._build_pairwise_similarity(textbooks, keyword_map)
        unique_topics = {
            textbook["id"]: [
                term
                for term in keyword_map[textbook["id"]]
                if all(term not in keyword_map[other["id"]] for other in textbooks if other["id"] != textbook["id"])
            ][:10]
            for textbook in textbooks
        }
        missing_topics = self._build_missing_topics(textbooks, keyword_map)

        return {
            "overview": {
                "textbook_count": len(textbooks),
                "shared_keyword_count": len(shared_keywords),
            },
            "shared_keywords": shared_keywords,
            "pairwise_similarity": pairwise_similarity,
            "unique_topics": unique_topics,
            "missing_topics": missing_topics,
            "combined_graph": self.graph_service.build_combined_graph(textbooks),
        }

    def build_combined_graph(self, textbooks: list[dict]) -> dict:
        textbooks = self._ensure_textbooks(textbooks)
        return self.graph_service.build_combined_graph(textbooks)

    def _ensure_textbooks(self, textbooks: list[dict]) -> list[dict]:
        if not textbooks:
            raise AppError("至少需要一本文教材才能执行跨教材分析。", 400)
        return textbooks

    def _collect_shared_keywords(self, textbooks: list[dict], keyword_map: dict[str, list[str]]) -> list[dict]:
        seen_terms: dict[str, list[str]] = {}
        for textbook in textbooks:
            for term in keyword_map[textbook["id"]]:
                seen_terms.setdefault(term, []).append(textbook["title"])

        result = [
            {"term": term, "textbooks": titles}
            for term, titles in seen_terms.items()
            if len(titles) > 1
        ]
        return sorted(result, key=lambda item: (-len(item["textbooks"]), item["term"]))

    def _build_pairwise_similarity(self, textbooks: list[dict], keyword_map: dict[str, list[str]]) -> list[dict]:
        items = []
        for index, left in enumerate(textbooks):
            left_set = set(keyword_map[left["id"]])
            for right in textbooks[index + 1 :]:
                right_set = set(keyword_map[right["id"]])
                union = left_set | right_set
                score = 0.0 if not union else round(len(left_set & right_set) / len(union), 3)
                items.append(
                    {
                        "left_textbook": left["title"],
                        "right_textbook": right["title"],
                        "similarity": score,
                        "shared_terms": sorted(left_set & right_set)[:10],
                    }
                )
        return items

    def _build_missing_topics(self, textbooks: list[dict], keyword_map: dict[str, list[str]]) -> dict:
        global_terms = set()
        for terms in keyword_map.values():
            global_terms.update(terms)

        result = {}
        for textbook in textbooks:
            own_terms = set(keyword_map[textbook["id"]])
            result[textbook["id"]] = sorted(global_terms - own_terms)[:12]
        return result
