from datetime import datetime
from uuid import uuid4

from ..clients.llm_client import ChatMessage


class DialogueService:
    def __init__(self, repository, llm_client, analysis_service, integration_service):
        self.repository = repository
        self.llm_client = llm_client
        self.analysis_service = analysis_service
        self.integration_service = integration_service

    def list_history(self) -> list[dict]:
        return list(reversed(self.repository.list_history()))

    def reply(self, message: str, textbooks: list[dict]) -> dict:
        analysis = self.analysis_service.compare_textbooks(textbooks) if textbooks else None
        summary = self.integration_service.generate_summary(textbooks, 0.25) if textbooks else None

        if self.llm_client.is_enabled() and textbooks:
            assistant_message = self._reply_with_llm(message, analysis, summary)
            mode = "llm"
        else:
            assistant_message = self._reply_locally(message, textbooks, analysis, summary)
            mode = "rule-based"

        item = {
            "id": uuid4().hex,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "teacher_message": message,
            "assistant_message": assistant_message,
            "mode": mode,
        }
        self.repository.append_turn(item)
        return item

    def _reply_locally(self, message: str, textbooks: list[dict], analysis: dict | None, summary: dict | None) -> str:
        if not textbooks:
            return "当前还没有可讨论的教材。请先上传教材，再进入教师对话。"

        shared_terms = ", ".join(item["term"] for item in (analysis or {}).get("shared_keywords", [])[:5]) or "暂无明显重叠主题"
        first_book = textbooks[0]
        missing_topics = ", ".join((analysis or {}).get("missing_topics", {}).get(first_book["id"], [])[:5]) or "暂无"

        if "缺" in message or "补" in message:
            return (
                f"从当前跨教材对比看，{first_book['title']} 相对缺少的主题包括：{missing_topics}。"
                "建议优先补齐这些主题对应的章节或案例。"
            )

        if "整合" in message or "摘要" in message:
            excerpt = ""
            if summary and summary.get("items"):
                excerpt = summary["items"][0]["text"][:80]
            return f"当前整合结果已压缩到约 {int((summary or {}).get('summary_ratio', 0.3) * 100)}%，代表性片段：{excerpt}"

        return (
            f"当前已接入 {len(textbooks)} 本教材，重叠主题主要有：{shared_terms}。"
            "如果要继续优化整合方案，建议先确认哪些主题必须保留原文深度，哪些主题适合压缩成统一表述。"
        )

    def _reply_with_llm(self, message: str, analysis: dict | None, summary: dict | None) -> str:
        return self.llm_client.chat(
            [
                ChatMessage(
                    role="system",
                    content=(
                        "你是学科教材整合助手，要围绕教材差异、摘要策略和教师反馈给出可执行建议。"
                    ),
                ),
                ChatMessage(
                    role="user",
                    content=(
                        f"教师消息：{message}\n\n"
                        f"跨教材分析：{analysis}\n\n"
                        f"当前整合摘要：{summary}"
                    ),
                ),
            ]
        )
