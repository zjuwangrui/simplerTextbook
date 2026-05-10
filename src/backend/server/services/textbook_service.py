import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from ..core.errors import AppError
from ..utils.file_loader import SUPPORTED_EXTENSIONS, parse_document_file
from ..utils.text_processing import build_chunks, extract_keywords, normalize_text, split_sentences

logger = logging.getLogger(__name__)


class TextbookService:
    def __init__(self, repository, graph_service, processing_settings):
        self.repository = repository
        self.graph_service = graph_service
        self.processing_settings = processing_settings
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="textbook-parser")

    def list_textbooks(self) -> list[dict]:
        return self.repository.list_textbooks()

    def get_textbook_detail(self, textbook_id: str) -> dict:
        return self.repository.get_textbook(textbook_id)

    def get_textbooks_by_ids(self, textbook_ids: list[str]) -> list[dict]:
        textbooks = self.repository.get_many(textbook_ids)
        pending = [item["title"] for item in textbooks if item.get("status") != "ready"]
        if pending:
            raise AppError("所选教材仍在解析中，暂无法执行该操作。", 400, {"pending_titles": pending})
        return textbooks

    def get_graph_payload(self, textbook_id: str) -> dict:
        detail = self.repository.get_textbook(textbook_id)
        graph = dict(detail.get("graph", {}))
        graph["graph_status"] = detail.get("graph_status", "not_started")
        graph["graph_progress"] = detail.get("graph_progress", {})
        graph["graph_error_message"] = detail.get("graph_error_message", "")
        return graph

    def get_graph_status(self, textbook_id: str) -> dict:
        detail = self.repository.get_textbook(textbook_id)
        return {
            "id": detail["id"],
            "textbook_id": detail.get("textbook_id", detail["id"]),
            "title": detail["title"],
            "graph_status": detail.get("graph_status", "not_started"),
            "graph_progress": detail.get("graph_progress", {}),
            "graph_error_message": detail.get("graph_error_message", ""),
        }

    def enqueue_graph_generation(self, textbook_id: str) -> dict:
        detail = self.repository.get_textbook(textbook_id)
        if detail.get("status") != "ready":
            raise AppError("教材正文尚未解析完成，无法生成图谱。", 400)

        if detail.get("graph_status") == "building":
            return self.get_graph_status(textbook_id)

        now = datetime.utcnow().isoformat() + "Z"
        detail["graph_status"] = "building"
        detail["graph_error_message"] = ""
        detail["graph_progress"] = {
            "phase": "queued",
            "current_chapter": 0,
            "total_chapters": len(detail.get("chapters", [])),
            "percent": 0,
            "message": "图谱任务已提交，等待执行。",
            "updated_at": now,
        }
        self.repository.save_textbook(detail)
        self.executor.submit(self._build_graph_job, textbook_id)
        return self.get_graph_status(textbook_id)

    def upload_textbooks(self, files) -> list[dict]:
        if not files:
            raise AppError("至少上传一个教材文件。", 400)

        results = []
        for file_storage in files:
            if not file_storage or not file_storage.filename:
                continue
            suffix = Path(file_storage.filename).suffix.lower()
            if suffix not in SUPPORTED_EXTENSIONS:
                raise AppError(
                    "文件格式不支持。",
                    400,
                    {"filename": file_storage.filename, "supported_extensions": sorted(SUPPORTED_EXTENSIONS)},
                )

            textbook_id = uuid4().hex[:12]
            stored_path = self.repository.save_uploaded_file(file_storage, textbook_id)
            placeholder = self._build_placeholder(textbook_id, file_storage.filename, suffix, stored_path)
            self.repository.save_textbook(placeholder)
            self.executor.submit(self._parse_textbook_job, textbook_id)
            results.append(self.repository.get_textbook_summary(textbook_id))

        if not results:
            raise AppError("没有检测到可处理的教材文件。", 400)
        return results

    def _build_placeholder(self, textbook_id: str, filename: str, suffix: str, stored_path: Path) -> dict:
        now = datetime.utcnow().isoformat() + "Z"
        return {
            "id": textbook_id,
            "textbook_id": textbook_id,
            "filename": filename,
            "title": Path(filename).stem,
            "format": suffix.replace(".", ""),
            "uploaded_at": now,
            "status": "parsing",
            "stored_path": str(stored_path),
            "file_size_bytes": stored_path.stat().st_size,
            "total_pages": 0,
            "total_chars": 0,
            "chapters": [],
            "sections": [],
            "chunks": [],
            "keywords": [],
            "keyword_preview": [],
            "graph": {"nodes": [], "edges": [], "stats": {"node_count": 0, "edge_count": 0, "chapter_count": 0}},
            "graph_status": "not_started",
            "graph_error_message": "",
            "graph_progress": {
                "phase": "idle",
                "current_chapter": 0,
                "total_chapters": 0,
                "percent": 0,
                "message": "正文解析完成后可单独生成图谱。",
                "updated_at": now,
            },
            "summary_preview": "",
            "error_message": "",
            "parse_progress": {
                "phase": "queued",
                "current_page": 0,
                "total_pages": 0,
                "percent": 0,
                "message": "文件已接收，等待解析。",
                "updated_at": now,
            },
            "stats": {
                "characters": 0,
                "sections": 0,
                "chunks": 0,
                "keywords": 0,
                "pages": 0,
            },
        }

    def _parse_textbook_job(self, textbook_id: str) -> None:
        detail = self.repository.get_textbook(textbook_id)
        stored_path = Path(detail["stored_path"])

        try:
            parsed = parse_document_file(
                stored_path,
                detail["title"],
                lambda progress: self._update_progress(textbook_id, progress),
            )

            sections = self._chapters_to_sections(parsed["chapters"])
            normalized_text = normalize_text("\n\n".join(section["text"] for section in sections))
            if len(normalized_text) < 80:
                raise AppError("教材文本过短，无法进入分析流程。", 400, {"filename": detail["filename"]})

            chunks = build_chunks(
                sections,
                chunk_size=self.processing_settings.chunk_size,
                overlap=self.processing_settings.chunk_overlap,
            )
            keywords = extract_keywords(normalized_text, self.processing_settings.keyword_top_k)
            summary_preview = self._build_summary_preview(sections)

            ready_detail = self.repository.get_textbook(textbook_id)
            ready_detail.update(
                {
                    "status": "ready",
                    "total_pages": parsed["total_pages"],
                    "total_chars": parsed["total_chars"],
                    "chapters": parsed["chapters"],
                    "sections": sections,
                    "chunks": chunks,
                    "keywords": keywords,
                    "keyword_preview": [item["term"] for item in keywords[:6]],
                    "graph": {
                        "nodes": [],
                        "edges": [],
                        "chapter_graphs": [],
                        "relation_types": [],
                        "stats": {"node_count": 0, "edge_count": 0, "chapter_count": len(parsed["chapters"]), "relation_type_count": 0},
                        "description": "正文已解析完成，尚未生成知识图谱。",
                    },
                    "graph_status": "not_started",
                    "graph_error_message": "",
                    "graph_progress": {
                        "phase": "idle",
                        "current_chapter": 0,
                        "total_chapters": len(parsed["chapters"]),
                        "percent": 0,
                        "message": "正文解析完成，可单独触发图谱生成。",
                        "updated_at": datetime.utcnow().isoformat() + "Z",
                    },
                    "summary_preview": summary_preview,
                    "error_message": "",
                    "parse_progress": {
                        "phase": "completed",
                        "current_page": parsed["total_pages"],
                        "total_pages": parsed["total_pages"],
                        "percent": 100,
                        "message": "解析完成。",
                        "updated_at": datetime.utcnow().isoformat() + "Z",
                    },
                    "stats": {
                        "characters": parsed["total_chars"],
                        "sections": len(sections),
                        "chunks": len(chunks),
                        "keywords": len(keywords),
                        "pages": parsed["total_pages"],
                    },
                }
            )
            self.repository.save_textbook(ready_detail)
        except AppError as error:
            logger.exception("Textbook parsing failed for %s", textbook_id)
            self._mark_parse_failed(textbook_id, error.message)
        except Exception as error:
            logger.exception("Unexpected textbook parsing failure for %s", textbook_id)
            self._mark_parse_failed(textbook_id, f"解析失败：{error}")

    def _build_graph_job(self, textbook_id: str) -> None:
        detail = self.repository.get_textbook(textbook_id)
        try:
            graph = self.graph_service.build_textbook_graph(
                textbook_id=textbook_id,
                textbook_title=detail["title"],
                chapters=detail.get("chapters", []),
                progress_callback=lambda progress: self._update_graph_progress(textbook_id, progress),
            )
            refreshed = self.repository.get_textbook(textbook_id)
            refreshed["graph"] = graph
            refreshed["graph_status"] = "ready"
            refreshed["graph_error_message"] = ""
            refreshed["graph_progress"] = {
                "phase": "completed",
                "current_chapter": len(refreshed.get("chapters", [])),
                "total_chapters": len(refreshed.get("chapters", [])),
                "percent": 100,
                "message": "知识图谱生成完成。",
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }
            self.repository.save_textbook(refreshed)
        except AppError as error:
            logger.exception("Textbook graph generation failed for %s", textbook_id)
            self._mark_graph_failed(textbook_id, error.message)
        except Exception as error:
            logger.exception("Unexpected textbook graph failure for %s", textbook_id)
            self._mark_graph_failed(textbook_id, f"图谱生成失败：{error}")

    def _update_progress(self, textbook_id: str, progress: dict) -> None:
        detail = self.repository.get_textbook(textbook_id)
        parse_progress = detail.get("parse_progress", {})
        parse_progress.update(progress)
        parse_progress["updated_at"] = datetime.utcnow().isoformat() + "Z"

        updated_pages = progress.get("total_pages", detail.get("total_pages", 0))
        updated_current_page = progress.get("current_page", 0)

        detail["status"] = "parsing"
        detail["total_pages"] = updated_pages or detail.get("total_pages", 0)
        detail["parse_progress"] = parse_progress
        detail["stats"] = detail.get("stats", {})
        detail["stats"]["pages"] = max(detail["stats"].get("pages", 0), updated_current_page)
        self.repository.save_textbook(detail)

    def _update_graph_progress(self, textbook_id: str, progress: dict) -> None:
        detail = self.repository.get_textbook(textbook_id)
        graph_progress = detail.get("graph_progress", {})
        current_chapter = progress.get("current_page", 0)
        total_chapters = progress.get("total_pages", len(detail.get("chapters", [])))
        graph_progress.update(
            {
                "phase": progress.get("phase", "knowledge_graph"),
                "current_chapter": current_chapter,
                "total_chapters": total_chapters,
                "percent": progress.get("percent", 0),
                "message": progress.get("message", ""),
                "updated_at": datetime.utcnow().isoformat() + "Z",
            }
        )
        detail["graph_status"] = "building"
        detail["graph_progress"] = graph_progress
        self.repository.save_textbook(detail)

    def _mark_parse_failed(self, textbook_id: str, message: str) -> None:
        detail = self.repository.get_textbook(textbook_id)
        detail["status"] = "failed"
        detail["error_message"] = message
        detail["parse_progress"] = {
            "phase": "failed",
            "current_page": detail.get("parse_progress", {}).get("current_page", 0),
            "total_pages": detail.get("total_pages", 0),
            "percent": detail.get("parse_progress", {}).get("percent", 0),
            "message": message,
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }
        self.repository.save_textbook(detail)

    def _mark_graph_failed(self, textbook_id: str, message: str) -> None:
        detail = self.repository.get_textbook(textbook_id)
        detail["graph_status"] = "failed"
        detail["graph_error_message"] = message
        detail["graph_progress"] = {
            "phase": "failed",
            "current_chapter": detail.get("graph_progress", {}).get("current_chapter", 0),
            "total_chapters": detail.get("graph_progress", {}).get("total_chapters", len(detail.get("chapters", []))),
            "percent": detail.get("graph_progress", {}).get("percent", 0),
            "message": message,
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }
        self.repository.save_textbook(detail)

    def _chapters_to_sections(self, chapters: list[dict]) -> list[dict]:
        sections = []
        index = 1
        for chapter in chapters:
            chapter_sections = chapter.get("sections") or []
            if chapter_sections:
                for section in chapter_sections:
                    sections.append(
                        {
                            "index": index,
                            "title": f"{chapter['title']} / {section['title']}",
                            "text": section["content"],
                        }
                    )
                    index += 1
                continue

            sections.append(
                {
                    "index": index,
                    "title": chapter["title"],
                    "text": chapter["content"],
                }
            )
            index += 1
        return sections

    def _build_summary_preview(self, sections: list[dict]) -> str:
        preview_sentences = []
        for section in sections[:3]:
            preview_sentences.extend(split_sentences(section["text"])[:2])
        return "\n".join(preview_sentences[:5])
