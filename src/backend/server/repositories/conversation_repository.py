import json
from pathlib import Path


class ConversationRepository:
    def __init__(self, storage_settings):
        self.history_file = Path(storage_settings.data_dir) / "dialogue.json"
        if not self.history_file.exists():
            self._write([])

    def list_history(self) -> list[dict]:
        return self._read()

    def append_turn(self, item: dict) -> dict:
        items = self._read()
        items.append(item)
        self._write(items)
        return item

    def _read(self) -> list[dict]:
        with self.history_file.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write(self, data: list[dict]) -> None:
        with self.history_file.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
