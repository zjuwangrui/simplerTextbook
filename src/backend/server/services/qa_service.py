import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ..clients.llm_client import ChatMessage
from ..core.errors import AppError
from ..utils.text_processing import split_sentences, tokenize_for_search


class QAService:
    def __init__(self, rag_settings, llm_client):
        self.rag_settings = rag_settings
        self.llm_client = llm_client

    def ask(self, question: str, textbooks: list[dict], top_k: int) -> dict:
        if not textbooks:
            raise AppError("至少需要一本文教材才能进行问答。", 400)

        corpus, metadata = self._build_corpus(textbooks)
        if not corpus:
            raise AppError("教材尚未形成可检索文本。", 400)

        effective_top_k = max(1, min(top_k or self.rag_settings.top_k, 8))
        vectorizer = TfidfVectorizer(tokenizer=tokenize_for_search, lowercase=False, token_pattern=None)
        matrix = vectorizer.fit_transform(corpus)
        query_vector = vectorizer.transform([question])
        scores = cosine_similarity(query_vector, matrix).flatten()

        top_indexes = np.argsort(scores)[::-1][:effective_top_k]
        citations = []
        for index in top_indexes:
            if scores[index] <= 0:
                continue
            item = metadata[index]
            citations.append(
                {
                    "textbook_id": item["textbook_id"],
                    "textbook_title": item["textbook_title"],
                    "section_title": item["section_title"],
                    "chunk_id": item["chunk_id"],
                    "score": round(float(scores[index]), 4),
                    "content": item["text"],
                }
            )

        if not citations:
            raise AppError("未检索到与问题相关的教材内容。", 404)

        mode = "extractive"
        if self.llm_client.is_enabled():
            answer = self._answer_with_llm(question, citations)
            mode = "llm"
        else:
            answer = self._answer_with_context(question, citations)

        return {
            "mode": mode,
            "question": question,
            "answer": answer,
            "citations": citations,
        }

    def _build_corpus(self, textbooks: list[dict]) -> tuple[list[str], list[dict]]:
        corpus = []
        metadata = []
        for textbook in textbooks:
            for chunk in textbook.get("chunks", []):
                corpus.append(chunk["text"])
                metadata.append(
                    {
                        "textbook_id": textbook["id"],
                        "textbook_title": textbook["title"],
                        "section_title": chunk["section_title"],
                        "chunk_id": chunk["chunk_id"],
                        "text": chunk["text"],
                    }
                )
        return corpus, metadata

    def _answer_with_context(self, question: str, citations: list[dict]) -> str:
        question_terms = set(tokenize_for_search(question))
        candidate_sentences = []

        for citation in citations:
            for sentence in split_sentences(citation["content"]):
                terms = set(tokenize_for_search(sentence))
                overlap = len(question_terms & terms)
                if overlap == 0:
                    continue
                candidate_sentences.append(
                    {
                        "text": sentence.strip(),
                        "score": overlap,
                        "source": citation["textbook_title"],
                        "section": citation["section_title"],
                    }
                )

        candidate_sentences.sort(key=lambda item: item["score"], reverse=True)
        selected = candidate_sentences[:3]
        if not selected:
            selected = [
                {
                    "text": citation["content"][:160].strip(),
                    "score": 0,
                    "source": citation["textbook_title"],
                    "section": citation["section_title"],
                }
                for citation in citations[:2]
            ]

        lines = ["根据当前检索到的教材原文，相关结论如下："]
        for index, item in enumerate(selected):
            lines.append(f"{index + 1}. {item['text']} [{item['source']} / {item['section']}]")
        lines.append("回答采用本地检索与摘录方式生成，引用见下方 citations。")
        return "\n".join(lines)

    def _answer_with_llm(self, question: str, citations: list[dict]) -> str:
        context = "\n\n".join(
            f"[{index + 1}] {item['textbook_title']} / {item['section_title']}\n{item['content']}"
            for index, item in enumerate(citations)
        )
        return self.llm_client.chat(
            [
                ChatMessage(
                    role="system",
                    content=(
                        "你是教材整合问答助手。只能根据给定教材片段作答，不允许编造，"
                        "回答中必须引用片段编号，例如 [1][2]。"
                    ),
                ),
                ChatMessage(
                    role="user",
                    content=f"问题：{question}\n\n教材片段：\n{context}",
                ),
            ]
        )
