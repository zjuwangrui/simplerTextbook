import json
from pathlib import Path


class ReportRepository:
    def __init__(self, storage_settings):
        self.reports_dir = Path(storage_settings.reports_dir)
        self.index_file = Path(storage_settings.data_dir) / "reports.json"
        if not self.index_file.exists():
            self._write_index([])

    def list_reports(self) -> list[dict]:
        return list(reversed(self._read_index()))

    def save_report(self, item: dict, content: str) -> dict:
        report_path = self.reports_dir / item["filename"]
        report_path.write_text(content, encoding="utf-8")
        items = self._read_index()
        items.append(item | {"path": str(report_path)})
        self._write_index(items)
        return item | {"path": str(report_path)}

    def _read_index(self) -> list[dict]:
        with self.index_file.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write_index(self, data: list[dict]) -> None:
        with self.index_file.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
