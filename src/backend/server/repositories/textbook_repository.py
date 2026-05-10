import json
import re
from pathlib import Path

from werkzeug.datastructures import FileStorage

from ..core.errors import AppError


class TextbookRepository:
    def __init__(self, storage_settings):
        self.index_file = Path(storage_settings.data_dir) / "textbooks.json"
        self.textbook_dir = Path(storage_settings.data_dir) / "textbooks"
        self.uploads_dir = Path(storage_settings.uploads_dir)
        if not self.index_file.exists():
            self._write_index([])

    def save_uploaded_file(self, file_storage: FileStorage, textbook_id: str) -> Path:
        original_name = Path(file_storage.filename or "").name
        if not original_name:
            raise AppError("上传文件缺少文件名。", 400)

        safe_name = self._safe_filename(original_name)
        target = self.uploads_dir / f"{textbook_id}_{safe_name}"
        file_storage.save(target)
        return target

    def list_textbooks(self) -> list[dict]:
        return list(reversed(self._read_index()))

    def get_textbook(self, textbook_id: str) -> dict:
        target = self.textbook_dir / f"{textbook_id}.json"
        if not target.exists():
            raise AppError("教材不存在。", 404, {"textbook_id": textbook_id})
        with target.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def get_textbook_summary(self, textbook_id: str) -> dict:
        return self._to_summary(self.get_textbook(textbook_id))

    def save_textbook(self, detail: dict) -> dict:
        detail_path = self.textbook_dir / f"{detail['id']}.json"
        self._write_json(detail_path, detail)

        index_items = self._read_index()
        index_items = [item for item in index_items if item["id"] != detail["id"]]
        index_items.append(self._to_summary(detail))
        self._write_index(index_items)
        return detail

    def update_textbook(self, textbook_id: str, changes: dict) -> dict:
        detail = self.get_textbook(textbook_id)
        detail.update(changes)
        return self.save_textbook(detail)

    def get_many(self, textbook_ids: list[str]) -> list[dict]:
        if not textbook_ids:
            return [self.get_textbook(item["id"]) for item in self.list_textbooks()]
        return [self.get_textbook(textbook_id) for textbook_id in textbook_ids]

    def _to_summary(self, detail: dict) -> dict:
        return {
            "id": detail["id"],
            "textbook_id": detail.get("textbook_id", detail["id"]),
            "title": detail["title"],
            "filename": detail["filename"],
            "format": detail["format"],
            "uploaded_at": detail["uploaded_at"],
            "status": detail["status"],
            "file_size_bytes": detail.get("file_size_bytes", 0),
            "total_pages": detail.get("total_pages", 0),
            "total_chars": detail.get("total_chars", 0),
            "parse_progress": detail.get("parse_progress", {}),
            "error_message": detail.get("error_message", ""),
            "stats": detail.get(
                "stats",
                {
                    "characters": 0,
                    "sections": 0,
                    "chunks": 0,
                    "keywords": 0,
                    "pages": 0,
                },
            ),
            "keyword_preview": detail.get("keyword_preview")
            or [item["term"] for item in detail.get("keywords", [])[:6]],
        }

    def _read_index(self) -> list[dict]:
        with self.index_file.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write_index(self, data: list[dict]) -> None:
        self._write_json(self.index_file, data)

    def _write_json(self, target: Path, data: dict | list) -> None:
        temp_target = target.with_suffix(f"{target.suffix}.tmp")
        with temp_target.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
        temp_target.replace(target)

    def _safe_filename(self, filename: str) -> str:
        stem = re.sub(r"[^\w.\-\u4e00-\u9fff]+", "_", filename, flags=re.UNICODE).strip("_")
        return stem or "textbook"
