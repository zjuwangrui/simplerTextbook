from collections import Counter
from itertools import combinations


class GraphService:
    def __init__(self, processing_settings):
        self.processing_settings = processing_settings

    def build_textbook_graph(self, sections: list[dict], chunks: list[dict], keywords: list[dict]) -> dict:
        section_nodes = [
            {
                "id": f"section:{section['index']}",
                "label": section["title"],
                "group": "section",
                "weight": max(len(section["text"]) // 300, 1),
            }
            for section in sections[:8]
        ]

        keyword_nodes = [
            {
                "id": f"keyword:{item['term']}",
                "label": item["term"],
                "group": "keyword",
                "weight": round(item["weight"], 3),
            }
            for item in keywords[: self.processing_settings.graph_keyword_limit]
        ]

        edges = []
        keyword_terms = [item["term"] for item in keywords[: self.processing_settings.graph_keyword_limit]]

        for section in sections[:8]:
            related_terms = [term for term in keyword_terms if term in section["text"]]
            for term in related_terms[:5]:
                edges.append(
                    {
                        "source": f"section:{section['index']}",
                        "target": f"keyword:{term}",
                        "weight": 1,
                    }
                )

        pair_counter: Counter[tuple[str, str]] = Counter()
        for chunk in chunks:
            related_terms = [term for term in keyword_terms if term in chunk["text"]]
            for left, right in combinations(sorted(set(related_terms)), 2):
                pair_counter[(left, right)] += 1

        for (left, right), weight in pair_counter.most_common(18):
            edges.append(
                {
                    "source": f"keyword:{left}",
                    "target": f"keyword:{right}",
                    "weight": weight,
                }
            )

        return {
            "nodes": section_nodes + keyword_nodes,
            "edges": edges,
            "stats": {
                "section_count": len(sections),
                "keyword_count": len(keywords),
                "edge_count": len(edges),
            },
        }

    def build_combined_graph(self, textbooks: list[dict]) -> dict:
        nodes = []
        edges = []
        keyword_books: dict[str, list[str]] = {}

        for textbook in textbooks:
            nodes.append(
                {
                    "id": f"book:{textbook['id']}",
                    "label": textbook["title"],
                    "group": "textbook",
                    "weight": textbook["stats"]["characters"] // 1000 + 1,
                }
            )
            for keyword in textbook["keywords"][:8]:
                keyword_books.setdefault(keyword["term"], []).append(textbook["title"])

        for term, titles in keyword_books.items():
            nodes.append(
                {
                    "id": f"term:{term}",
                    "label": term,
                    "group": "shared-keyword" if len(titles) > 1 else "unique-keyword",
                    "weight": len(titles),
                }
            )
            for title in titles:
                edges.append(
                    {
                        "source": f"term:{term}",
                        "target": self._find_book_node_id(textbooks, title),
                        "weight": len(titles),
                    }
                )

        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "textbook_count": len(textbooks),
                "shared_keyword_count": sum(1 for titles in keyword_books.values() if len(titles) > 1),
                "edge_count": len(edges),
            },
        }

    def _find_book_node_id(self, textbooks: list[dict], title: str) -> str:
        for textbook in textbooks:
            if textbook["title"] == title:
                return f"book:{textbook['id']}"
        return f"book:{title}"
