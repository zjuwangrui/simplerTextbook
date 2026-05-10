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
    return jsonify({"items": items}), 202


@textbooks_bp.get("/<textbook_id>")
def get_textbook(textbook_id: str):
    service = current_app.config["services"]["textbook"]
    detail = service.get_textbook_detail(textbook_id)
    detail["parsed_output"] = {
        "textbook_id": detail.get("textbook_id", detail["id"]),
        "filename": detail["filename"],
        "title": detail["title"],
        "total_pages": detail.get("total_pages", 0),
        "total_chars": detail.get("total_chars", 0),
        "chapters": detail.get("chapters", []),
    }
    return jsonify(detail)


@textbooks_bp.get("/<textbook_id>/status")
def get_textbook_status(textbook_id: str):
    service = current_app.config["services"]["textbook"]
    detail = service.get_textbook_detail(textbook_id)
    return jsonify(
        {
            "id": detail["id"],
            "textbook_id": detail.get("textbook_id", detail["id"]),
            "filename": detail["filename"],
            "title": detail["title"],
            "status": detail["status"],
            "parse_progress": detail.get("parse_progress", {}),
            "error_message": detail.get("error_message", ""),
            "graph_status": detail.get("graph_status", "not_started"),
            "graph_progress": detail.get("graph_progress", {}),
            "graph_error_message": detail.get("graph_error_message", ""),
            "total_pages": detail.get("total_pages", 0),
            "total_chars": detail.get("total_chars", 0),
            "detail_url": f"/api/textbooks/{textbook_id}",
        }
    )


@textbooks_bp.get("/<textbook_id>/summary")
def get_textbook_summary(textbook_id: str):
    service = current_app.config["services"]["textbook"]
    detail = service.get_textbook_detail(textbook_id)
    if "summary_preview" not in detail:
        raise AppError("教材摘要不存在。", 404)
    return jsonify({"summary_preview": detail["summary_preview"]})
