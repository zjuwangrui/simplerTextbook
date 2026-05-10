from datetime import datetime
from pathlib import Path
from uuid import uuid4

from ..core.errors import AppError
from ..utils.file_loader import SUPPORTED_EXTENSIONS, load_text_from_path
from ..utils.text_processing import build_chunks, extract_keywords, extract_sections, normalize_text, split_sentences


class TextbookService:
    def __init__(self, repository, graph_service, processing_settings):
        self.repository = repository
        self.graph_service = graph_service
        self.processing_settings = processing_settings

    def list_textbooks(self) -> list[dict]:
        return self.repository.list_textbooks()

    def get_textbook_detail(self, textbook_id: str) -> dict:
        return self.repository.get_textbook(textbook_id)

    def get_textbooks_by_ids(self, textbook_ids: list[str]) -> list[dict]:
        return self.repository.get_many(textbook_ids)

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
            raw_text = load_text_from_path(stored_path)
            normalized_text = normalize_text(raw_text)
            if len(normalized_text) < 80:
                raise AppError("教材文本过短，无法进入分析流程。", 400, {"filename": file_storage.filename})

            sections = extract_sections(normalized_text)
            chunks = build_chunks(
                sections,
                chunk_size=self.processing_settings.chunk_size,
                overlap=self.processing_settings.chunk_overlap,
            )
            keywords = extract_keywords(normalized_text, self.processing_settings.keyword_top_k)
            graph = self.graph_service.build_textbook_graph(sections, chunks, keywords)

            detail = {
                "id": textbook_id,
                "title": Path(file_storage.filename).stem,
                "filename": file_storage.filename,
                "format": suffix.replace(".", ""),
                "uploaded_at": datetime.utcnow().isoformat() + "Z",
                "status": "ready",
                "stored_path": str(stored_path),
                "stats": {
                    "characters": len(normalized_text),
                    "sections": len(sections),
                    "chunks": len(chunks),
                    "keywords": len(keywords),
                },
                "sections": sections,
                "chunks": chunks,
                "keywords": keywords,
                "keyword_preview": [item["term"] for item in keywords[:6]],
                "graph": graph,
                "summary_preview": self._build_summary_preview(sections),
            }
            self.repository.save_textbook(detail)
            results.append(self.repository.list_textbooks()[0])

        if not results:
            raise AppError("没有检测到可处理的教材文件。", 400)
        return results

    def _build_summary_preview(self, sections: list[dict]) -> str:
        preview_sentences = []
        for section in sections[:3]:
            preview_sentences.extend(split_sentences(section["text"])[:2])
        return "\n".join(preview_sentences[:5])
