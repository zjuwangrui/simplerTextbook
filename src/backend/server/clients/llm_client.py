from dataclasses import dataclass

import requests

from ..core.errors import AppError


@dataclass
class ChatMessage:
    role: str
    content: str


class OpenAICompatibleClient:
    def __init__(self, settings):
        self.settings = settings

    def is_enabled(self) -> bool:
        return self.settings.enabled and bool(self.settings.api_key)

    def chat(self, messages: list[ChatMessage]) -> str:
        if not self.is_enabled():
            raise AppError("未启用外部大模型客户端。", 400)

        response = requests.post(
            f"{self.settings.base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {self.settings.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.settings.model,
                "messages": [message.__dict__ for message in messages],
                "temperature": 0.2,
            },
            timeout=self.settings.timeout_seconds,
        )
        if not response.ok:
            raise AppError(
                "外部大模型调用失败。",
                502,
                {"status_code": response.status_code, "body": response.text[:500]},
            )

        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            raise AppError("外部大模型返回为空。", 502)
        return (choices[0].get("message") or {}).get("content", "").strip()
