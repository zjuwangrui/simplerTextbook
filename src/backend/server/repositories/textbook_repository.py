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

    def save_textbook(self, detail: dict) -> dict:
        detail_path = self.textbook_dir / f"{detail['id']}.json"
        with detail_path.open("w", encoding="utf-8") as handle:
            json.dump(detail, handle, ensure_ascii=False, indent=2)

        index_items = self._read_index()
        index_items = [item for item in index_items if item["id"] != detail["id"]]
        index_items.append(self._to_summary(detail))
        self._write_index(index_items)
        return detail

    def get_many(self, textbook_ids: list[str]) -> list[dict]:
        if not textbook_ids:
            return [self.get_textbook(item["id"]) for item in self.list_textbooks()]
        return [self.get_textbook(textbook_id) for textbook_id in textbook_ids]

    def _to_summary(self, detail: dict) -> dict:
        return {
            "id": detail["id"],
            "title": detail["title"],
            "filename": detail["filename"],
            "format": detail["format"],
            "uploaded_at": detail["uploaded_at"],
            "status": detail["status"],
            "stats": detail["stats"],
            "keyword_preview": [item["term"] for item in detail["keywords"][:6]],
        }

    def _read_index(self) -> list[dict]:
        with self.index_file.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write_index(self, data: list[dict]) -> None:
        with self.index_file.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)

    def _safe_filename(self, filename: str) -> str:
        stem = re.sub(r"[^\w.\-\u4e00-\u9fff]+", "_", filename, flags=re.UNICODE).strip("_")
        return stem or "textbook"
