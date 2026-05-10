from datetime import datetime

from ..core.errors import AppError


class ReportService:
    def __init__(self, repository, analysis_service, integration_service):
        self.repository = repository
        self.analysis_service = analysis_service
        self.integration_service = integration_service

    def list_reports(self) -> list[dict]:
        return self.repository.list_reports()

    def generate_report(self, textbooks: list[dict], history: list[dict]) -> dict:
        if not textbooks:
            raise AppError("至少需要一本文教材才能生成报告。", 400)

        analysis = self.analysis_service.compare_textbooks(textbooks)
        summary = self.integration_service.generate_summary(textbooks)
        generated_at = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        filename = f"report-{generated_at}.md"

        content = self._build_markdown(textbooks, analysis, summary, history)
        item = {
            "generated_at": generated_at,
            "filename": filename,
            "textbook_count": len(textbooks),
            "shared_keyword_count": analysis["overview"]["shared_keyword_count"],
        }
        saved = self.repository.save_report(item, content)
        return saved | {"content": content}

    def _build_markdown(self, textbooks: list[dict], analysis: dict, summary: dict, history: list[dict]) -> str:
        lines = [
            "# 学科知识整合报告",
            "",
            "## 教材概览",
            "",
        ]
        for textbook in textbooks:
            lines.append(
                f"- {textbook['title']} | 字数 {textbook['stats']['characters']} | 章节 {textbook['stats']['sections']} | 关键词 {textbook['stats']['keywords']}"
            )

        lines.extend(
            [
                "",
                "## 跨教材重叠与差异",
                "",
                f"- 共享关键词数量：{analysis['overview']['shared_keyword_count']}",
            ]
        )
        for item in analysis["shared_keywords"][:10]:
            lines.append(f"- {item['term']} -> {', '.join(item['textbooks'])}")

        lines.extend(["", "## 整合摘要", "", summary["summary_text"], "", "## 教师对话摘录", ""])
        if history:
            for item in history[:5]:
                lines.append(f"- 教师：{item['teacher_message']}")
                lines.append(f"- 助手：{item['assistant_message']}")
        else:
            lines.append("- 暂无教师反馈记录。")

        return "\n".join(lines)
