import json
import re
from pathlib import Path

from ..clients.llm_client import ChatMessage
from ..core.errors import AppError

ALLOWED_RELATION_TYPES = {"prerequisite", "parallel", "contains", "applies_to"}


class GraphService:
    def __init__(self, processing_settings, llm_client, prompt_path: Path):
        self.processing_settings = processing_settings
        self.llm_client = llm_client
        self.prompt_path = prompt_path

    def build_textbook_graph(
        self,
        textbook_id: str,
        textbook_title: str,
        chapters: list[dict],
        progress_callback=None,
    ) -> dict:
        if not self.llm_client.is_enabled():
            raise AppError("未启用大模型客户端，无法构建知识图谱。", 400)

        prompt_template = self._load_prompt_template()
        nodes_by_id: dict[str, dict] = {}
        name_to_id: dict[str, str] = {}
        edges: list[dict] = []
        edge_keys: set[tuple[str, str, str]] = set()
        chapter_graphs: list[dict] = []
        next_node_index = 1
        total_chapters = max(len(chapters), 1)

        for chapter_index, chapter in enumerate(chapters, start=1):
            if progress_callback is not None:
                progress_callback(
                    {
                        "phase": "knowledge_graph",
                        "current_page": chapter_index,
                        "total_pages": len(chapters),
                        "percent": int(chapter_index / total_chapters * 100),
                        "message": f"正在为章节《{chapter['title']}》提取知识图谱。",
                    }
                )

            payload = self._extract_chapter_graph(prompt_template, textbook_title, chapter)
            chapter_node_map: dict[str, str] = {}

            for item in payload.get("knowledge_points", []):
                normalized = self._normalize_node(item, chapter, next_node_index)
                if normalized is None:
                    continue

                canonical_key = self._canonical_name(normalized["name"])
                if canonical_key in name_to_id:
                    canonical_id = name_to_id[canonical_key]
                    existing = nodes_by_id[canonical_id]
                    if len(normalized["definition"]) > len(existing["definition"]):
                        existing["definition"] = normalized["definition"]
                    existing["frequency"] = int(existing.get("frequency", 1)) + 1
                    existing["weight"] = max(existing.get("weight", 1), existing["frequency"])
                    existing["source_textbooks"] = sorted(
                        set(existing.get("source_textbooks", []) + [textbook_title])
                    )
                    existing["source_count"] = len(existing["source_textbooks"])
                    existing["chapters"] = sorted(set(existing.get("chapters", []) + [normalized["chapter"]]))
                    existing["mentions"].append(
                        {
                            "textbook_title": textbook_title,
                            "chapter": normalized["chapter"],
                            "page": normalized["page"],
                            "source_temp_id": normalized["source_temp_id"],
                        }
                    )
                    chapter_node_map[normalized["source_temp_id"]] = canonical_id
                    continue

                canonical_id = f"node_{next_node_index:03d}"
                next_node_index += 1
                node = {
                    "id": canonical_id,
                    "name": normalized["name"],
                    "label": normalized["name"],
                    "definition": normalized["definition"],
                    "category": normalized["category"],
                    "chapter": normalized["chapter"],
                    "page": normalized["page"],
                    "group": normalized["category"],
                    "weight": 1,
                    "frequency": 1,
                    "source_textbooks": [textbook_title],
                    "source_count": 1,
                    "chapters": [normalized["chapter"]],
                    "mentions": [
                        {
                            "textbook_title": textbook_title,
                            "chapter": normalized["chapter"],
                            "page": normalized["page"],
                            "source_temp_id": normalized["source_temp_id"],
                        }
                    ],
                }
                nodes_by_id[canonical_id] = node
                name_to_id[canonical_key] = canonical_id
                chapter_node_map[normalized["source_temp_id"]] = canonical_id

            chapter_edges = []
            for item in payload.get("relations", []):
                normalized_edge = self._normalize_edge(item, chapter_node_map, nodes_by_id)
                if normalized_edge is None:
                    continue
                edge_key = (
                    normalized_edge["source"],
                    normalized_edge["target"],
                    normalized_edge["relation_type"],
                )
                if edge_key in edge_keys:
                    continue
                edge_keys.add(edge_key)
                edges.append(normalized_edge)
                chapter_edges.append(normalized_edge)

            chapter_graphs.append(
                {
                    "chapter_id": chapter["chapter_id"],
                    "chapter_title": chapter["title"],
                    "page_start": chapter["page_start"],
                    "page_end": chapter["page_end"],
                    "knowledge_point_count": len(chapter_node_map),
                    "relation_count": len(chapter_edges),
                }
            )

        return {
            "textbook_id": textbook_id,
            "textbook_title": textbook_title,
            "nodes": list(nodes_by_id.values()),
            "edges": edges,
            "chapter_graphs": chapter_graphs,
            "relation_types": sorted({edge["relation_type"] for edge in edges}),
            "stats": {
                "chapter_count": len(chapters),
                "node_count": len(nodes_by_id),
                "edge_count": len(edges),
                "relation_type_count": len({edge["relation_type"] for edge in edges}),
            },
            "description": "基于章节级 LLM 抽取的教材知识图谱可视化数据。",
        }

    def build_combined_graph(self, textbooks: list[dict]) -> dict:
        if all(
            textbook.get("graph_status") == "ready" and (textbook.get("graph") or {}).get("nodes")
            for textbook in textbooks
        ):
            return self._build_merged_knowledge_graph(textbooks)

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

    def _build_merged_knowledge_graph(self, textbooks: list[dict]) -> dict:
        merged_nodes: dict[str, dict] = {}
        edge_map: dict[tuple[str, str, str], dict] = {}

        for textbook in textbooks:
            local_map: dict[str, str] = {}
            for node in textbook.get("graph", {}).get("nodes", []):
                canonical_key = self._canonical_name(node.get("name") or node.get("label") or node["id"])
                if canonical_key not in merged_nodes:
                    merged_id = f"merged_{len(merged_nodes) + 1:03d}"
                    merged_nodes[canonical_key] = {
                        "id": merged_id,
                        "name": node.get("name") or node.get("label") or node["id"],
                        "label": node.get("label") or node.get("name") or node["id"],
                        "definition": node.get("definition", ""),
                        "category": node.get("category", node.get("group", "知识点")),
                        "chapter": node.get("chapter", ""),
                        "page": node.get("page", 0),
                        "group": node.get("category", node.get("group", "知识点")),
                        "weight": 1,
                        "frequency": 0,
                        "source_textbooks": [],
                        "source_count": 0,
                        "chapters": [],
                        "mentions": [],
                    }

                merged_node = merged_nodes[canonical_key]
                local_map[node["id"]] = merged_node["id"]
                if len(str(node.get("definition", ""))) > len(str(merged_node.get("definition", ""))):
                    merged_node["definition"] = node.get("definition", "")
                merged_node["chapter"] = merged_node.get("chapter") or node.get("chapter", "")
                merged_node["page"] = merged_node.get("page") or node.get("page", 0)
                merged_node["source_textbooks"] = sorted(
                    set(merged_node.get("source_textbooks", []) + [textbook["title"]])
                )
                merged_node["source_count"] = len(merged_node["source_textbooks"])
                merged_node["chapters"] = sorted(
                    set(merged_node.get("chapters", []) + node.get("chapters", []))
                )
                merged_node["mentions"].extend(node.get("mentions", []))
                merged_node["frequency"] = len(merged_node["mentions"]) or merged_node["source_count"]
                merged_node["weight"] = max(1, merged_node["frequency"])

            for edge in textbook.get("graph", {}).get("edges", []):
                source_id = local_map.get(edge["source"])
                target_id = local_map.get(edge["target"])
                relation_type = edge.get("relation_type", "related")
                if source_id is None or target_id is None:
                    continue
                edge_key = (source_id, target_id, relation_type)
                if edge_key not in edge_map:
                    edge_map[edge_key] = {
                        "source": source_id,
                        "target": target_id,
                        "relation_type": relation_type,
                        "description": edge.get("description", ""),
                        "label": edge.get("label", relation_type),
                        "weight": 1,
                        "source_textbooks": [textbook["title"]],
                    }
                else:
                    edge_map[edge_key]["weight"] = int(edge_map[edge_key]["weight"]) + 1
                    edge_map[edge_key]["source_textbooks"] = sorted(
                        set(edge_map[edge_key].get("source_textbooks", []) + [textbook["title"]])
                    )

        return {
            "nodes": list(merged_nodes.values()),
            "edges": list(edge_map.values()),
            "relation_types": sorted({edge["relation_type"] for edge in edge_map.values()}),
            "chapter_graphs": [],
            "description": "多教材知识点图谱：合并相同知识点后展示来源与频次。",
            "stats": {
                "textbook_count": len(textbooks),
                "node_count": len(merged_nodes),
                "edge_count": len(edge_map),
                "relation_type_count": len({edge["relation_type"] for edge in edge_map.values()}),
            },
            "source_textbooks": [textbook["title"] for textbook in textbooks],
        }

    def _extract_chapter_graph(self, prompt_template: str, textbook_title: str, chapter: dict) -> dict:
        prompt = (
            prompt_template.replace("{{textbook_title}}", textbook_title)
            .replace("{{chapter_title}}", chapter["title"])
            .replace("{{chapter_id}}", chapter["chapter_id"])
            .replace("{{page_start}}", str(chapter["page_start"]))
            .replace("{{page_end}}", str(chapter["page_end"]))
            .replace("{{chapter_content}}", chapter["content"])
        )

        response = self.llm_client.chat(
            [
                ChatMessage(
                    role="system",
                    content="你必须严格输出合法 JSON，不允许输出 Markdown 代码块或解释文字。",
                ),
                ChatMessage(role="user", content=prompt),
            ]
        )

        payload = self._parse_json_payload(response)
        if not isinstance(payload, dict):
            raise AppError("知识图谱抽取返回的 JSON 结构无效。", 502)
        payload.setdefault("knowledge_points", [])
        payload.setdefault("relations", [])
        return payload

    def _normalize_node(self, item: dict, chapter: dict, next_index: int) -> dict | None:
        if not isinstance(item, dict):
            return None

        name = str(item.get("name", "")).strip()
        if not name:
            return None

        temp_id = str(item.get("id", f"temp_node_{next_index}")).strip() or f"temp_node_{next_index}"
        definition = str(item.get("definition", "")).strip() or "待补充定义。"
        category = str(item.get("category", "")).strip() or "核心概念"
        chapter_title = str(item.get("chapter", "")).strip() or chapter["title"]
        page = self._normalize_page(item.get("page"), chapter["page_start"], chapter["page_end"])

        return {
            "source_temp_id": temp_id,
            "name": name,
            "definition": definition,
            "category": category,
            "chapter": chapter_title,
            "page": page,
        }

    def _normalize_edge(self, item: dict, chapter_node_map: dict[str, str], nodes_by_id: dict[str, dict]) -> dict | None:
        if not isinstance(item, dict):
            return None

        source_value = str(item.get("source", "")).strip()
        target_value = str(item.get("target", "")).strip()
        relation_type = self._normalize_relation_type(item.get("relation_type"))
        if not source_value or not target_value or relation_type is None:
            return None

        source_id = self._resolve_node_reference(source_value, chapter_node_map, nodes_by_id)
        target_id = self._resolve_node_reference(target_value, chapter_node_map, nodes_by_id)
        if source_id is None or target_id is None or source_id == target_id:
            return None

        description = str(item.get("description", "")).strip() or f"{source_id} -> {target_id}"
        return {
            "source": source_id,
            "target": target_id,
            "relation_type": relation_type,
            "description": description,
            "label": relation_type,
            "weight": 1,
        }

    def _resolve_node_reference(self, value: str, chapter_node_map: dict[str, str], nodes_by_id: dict[str, dict]) -> str | None:
        if value in chapter_node_map:
            return chapter_node_map[value]

        key = self._canonical_name(value)
        for node_id, node in nodes_by_id.items():
            if self._canonical_name(node["name"]) == key:
                return node_id
        return None

    def _normalize_page(self, value, min_page: int, max_page: int) -> int:
        try:
            page = int(value)
        except (TypeError, ValueError):
            page = min_page
        return max(min_page, min(page, max_page))

    def _normalize_relation_type(self, value) -> str | None:
        relation_type = str(value or "").strip().lower()
        if relation_type in ALLOWED_RELATION_TYPES:
            return relation_type
        return None

    def _canonical_name(self, value: str) -> str:
        return re.sub(r"\s+", "", value).lower()

    def _parse_json_payload(self, content: str):
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if not match:
                raise AppError("知识图谱抽取结果不是合法 JSON。", 502, {"content": cleaned[:800]})
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError as error:
                raise AppError(
                    "知识图谱抽取结果 JSON 解析失败。",
                    502,
                    {"content": cleaned[:800], "error": str(error)},
                )

    def _load_prompt_template(self) -> str:
        if not self.prompt_path.exists():
            raise AppError("知识图谱提示词文件不存在。", 500, {"prompt_file": str(self.prompt_path)})
        return self.prompt_path.read_text(encoding="utf-8")

    def _find_book_node_id(self, textbooks: list[dict], title: str) -> str:
        for textbook in textbooks:
            if textbook["title"] == title:
                return f"book:{textbook['id']}"
        return f"book:{title}"
