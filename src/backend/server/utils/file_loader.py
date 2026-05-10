from pathlib import Path

from docx import Document
from pypdf import PdfReader

from ..core.errors import AppError

SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf", ".docx"}


def load_text_from_path(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise AppError("文件格式不支持。", 400, {"path": str(path), "suffix": suffix})

    if suffix in {".txt", ".md"}:
        return path.read_text(encoding="utf-8", errors="ignore")

    if suffix == ".pdf":
        reader = PdfReader(str(path))
        return "\n".join((page.extract_text() or "") for page in reader.pages)

    if suffix == ".docx":
        document = Document(str(path))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)

    raise AppError("无法读取指定文件。", 400, {"path": str(path)})
