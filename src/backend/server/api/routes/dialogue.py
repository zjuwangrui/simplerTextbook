from flask import Blueprint, current_app, jsonify, request

from ...core.errors import AppError

dialogue_bp = Blueprint("dialogue", __name__, url_prefix="/api/dialogue")


@dialogue_bp.get("/history")
def get_history():
    service = current_app.config["services"]["dialogue"]
    return jsonify({"items": service.list_history()})


@dialogue_bp.post("/message")
def send_message():
    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    if not message:
        raise AppError("消息不能为空。", 400)

    textbook_ids = payload.get("textbook_ids") or []
    textbook_service = current_app.config["services"]["textbook"]
    textbooks = textbook_service.get_textbooks_by_ids(textbook_ids)
    service = current_app.config["services"]["dialogue"]
    return jsonify(service.reply(message, textbooks))
