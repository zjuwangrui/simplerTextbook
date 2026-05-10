from flask import Blueprint, current_app, jsonify, request

from ...core.errors import AppError

textbooks_bp = Blueprint("textbooks", __name__, url_prefix="/api/textbooks")


@textbooks_bp.get("")
def list_textbooks():
    service = current_app.config["services"]["textbook"]
    return jsonify({"items": service.list_textbooks()})


@textbooks_bp.post("/upload")
def upload_textbooks():
    files = request.files.getlist("files")
    service = current_app.config["services"]["textbook"]
    items = service.upload_textbooks(files)
    return jsonify({"items": items}), 201


@textbooks_bp.get("/<textbook_id>")
def get_textbook(textbook_id: str):
    service = current_app.config["services"]["textbook"]
    return jsonify(service.get_textbook_detail(textbook_id))


@textbooks_bp.get("/<textbook_id>/summary")
def get_textbook_summary(textbook_id: str):
    service = current_app.config["services"]["textbook"]
    detail = service.get_textbook_detail(textbook_id)
    if "summary_preview" not in detail:
        raise AppError("教材摘要不存在。", 404)
    return jsonify({"summary_preview": detail["summary_preview"]})
