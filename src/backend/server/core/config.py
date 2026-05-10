import os
from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass
class AppSection:
    host: str
    port: int
    max_upload_mb: int
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
    prompt_file: Path


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
            host=_get_str_env("APP_HOST", raw["app"]["host"]),
            port=_get_int_env("APP_PORT", raw["app"]["port"]),
            max_upload_mb=_get_int_env("APP_MAX_UPLOAD_MB", raw["app"].get("max_upload_mb", 512)),
            cors_origins=_get_list_env("APP_CORS_ORIGINS", raw["app"].get("cors_origins", [])),
        ),
        storage=StorageSection(
            data_dir=_resolve_path(base_dir, _get_str_env("DATA_DIR", raw["storage"]["data_dir"])),
            uploads_dir=_resolve_path(base_dir, _get_str_env("UPLOADS_DIR", raw["storage"]["uploads_dir"])),
            logs_dir=_resolve_path(base_dir, _get_str_env("LOGS_DIR", raw["storage"]["logs_dir"])),
            reports_dir=_resolve_path(base_dir, _get_str_env("REPORTS_DIR", raw["storage"]["reports_dir"])),
        ),
        processing=ProcessingSection(
            chunk_size=_get_int_env("PROCESSING_CHUNK_SIZE", raw["processing"]["chunk_size"]),
            chunk_overlap=_get_int_env("PROCESSING_CHUNK_OVERLAP", raw["processing"]["chunk_overlap"]),
            keyword_top_k=_get_int_env("PROCESSING_KEYWORD_TOP_K", raw["processing"]["keyword_top_k"]),
            graph_keyword_limit=_get_int_env("PROCESSING_GRAPH_KEYWORD_LIMIT", raw["processing"]["graph_keyword_limit"]),
            summary_ratio=_get_float_env("PROCESSING_SUMMARY_RATIO", raw["processing"]["summary_ratio"]),
        ),
        rag=RagSection(top_k=_get_int_env("RAG_TOP_K", raw["rag"]["top_k"])),
        llm=LLMSection(
            enabled=_get_bool_env("LLM_ENABLED", raw["llm"]["enabled"]),
            base_url=_get_str_env("LLM_BASE_URL", str(raw["llm"]["base_url"])),
            api_key=_get_str_env("LLM_API_KEY", str(raw["llm"]["api_key"])),
            model=_get_str_env("LLM_MODEL", str(raw["llm"]["model"])),
            timeout_seconds=_get_int_env("LLM_TIMEOUT_SECONDS", raw["llm"]["timeout_seconds"]),
            prompt_file=_resolve_path(
                base_dir,
                _get_str_env("LLM_PROMPT_FILE", str(raw["llm"].get("prompt_file", "config/prompt.md"))),
            ),
        ),
    )


def _resolve_path(base_dir: Path, value: str) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate
    return (base_dir / candidate).resolve()


def _get_str_env(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None or value == "":
        return str(default)
    return value


def _get_int_env(name: str, default) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return int(default)
    return int(value)


def _get_float_env(name: str, default) -> float:
    value = os.getenv(name)
    if value is None or value == "":
        return float(default)
    return float(value)


def _get_bool_env(name: str, default) -> bool:
    value = os.getenv(name)
    if value is None or value == "":
        return bool(default)
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_list_env(name: str, default: list[str]) -> list[str]:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]
