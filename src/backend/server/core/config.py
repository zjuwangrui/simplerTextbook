from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass
class AppSection:
    host: str
    port: int
    cors_origins: list[str]


@dataclass
class StorageSection:
    data_dir: Path
    uploads_dir: Path
    logs_dir: Path
    reports_dir: Path


@dataclass
class ProcessingSection:
    chunk_size: int
    chunk_overlap: int
    keyword_top_k: int
    graph_keyword_limit: int
    summary_ratio: float


@dataclass
class RagSection:
    top_k: int


@dataclass
class LLMSection:
    enabled: bool
    base_url: str
    api_key: str
    model: str
    timeout_seconds: int


@dataclass
class Settings:
    base_dir: Path
    app: AppSection
    storage: StorageSection
    processing: ProcessingSection
    rag: RagSection
    llm: LLMSection

    def ensure_directories(self) -> None:
        self.storage.data_dir.mkdir(parents=True, exist_ok=True)
        self.storage.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.storage.logs_dir.mkdir(parents=True, exist_ok=True)
        self.storage.reports_dir.mkdir(parents=True, exist_ok=True)
        (self.storage.data_dir / "textbooks").mkdir(parents=True, exist_ok=True)


def load_settings() -> Settings:
    base_dir = Path(__file__).resolve().parents[2]
    config_path = base_dir / "config" / "app.yaml"
    with config_path.open("r", encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}

    return Settings(
        base_dir=base_dir,
        app=AppSection(
            host=raw["app"]["host"],
            port=int(raw["app"]["port"]),
            cors_origins=list(raw["app"].get("cors_origins", [])),
        ),
        storage=StorageSection(
            data_dir=_resolve_path(base_dir, raw["storage"]["data_dir"]),
            uploads_dir=_resolve_path(base_dir, raw["storage"]["uploads_dir"]),
            logs_dir=_resolve_path(base_dir, raw["storage"]["logs_dir"]),
            reports_dir=_resolve_path(base_dir, raw["storage"]["reports_dir"]),
        ),
        processing=ProcessingSection(
            chunk_size=int(raw["processing"]["chunk_size"]),
            chunk_overlap=int(raw["processing"]["chunk_overlap"]),
            keyword_top_k=int(raw["processing"]["keyword_top_k"]),
            graph_keyword_limit=int(raw["processing"]["graph_keyword_limit"]),
            summary_ratio=float(raw["processing"]["summary_ratio"]),
        ),
        rag=RagSection(top_k=int(raw["rag"]["top_k"])),
        llm=LLMSection(
            enabled=bool(raw["llm"]["enabled"]),
            base_url=str(raw["llm"]["base_url"]),
            api_key=str(raw["llm"]["api_key"]),
            model=str(raw["llm"]["model"]),
            timeout_seconds=int(raw["llm"]["timeout_seconds"]),
        ),
    )


def _resolve_path(base_dir: Path, value: str) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate
    return (base_dir / candidate).resolve()
