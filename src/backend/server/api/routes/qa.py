from flask import Blueprint, current_app, jsonify, request

from ...core.errors import AppError

qa_bp = Blueprint("qa", __name__, url_prefix="/api/qa")


@qa_bp.post("/ask")
def ask_question():
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()
    if not question:
        raise AppError("问题不能为空。", 400)

    textbook_ids = payload.get("textbook_ids") or []
    top_k = int(payload.get("top_k", 5))

    textbook_service = current_app.config["services"]["textbook"]
    service = current_app.config["services"]["qa"]
    textbooks = textbook_service.get_textbooks_by_ids(textbook_ids)
    return jsonify(service.ask(question, textbooks, top_k))
