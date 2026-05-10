from flask import Blueprint, current_app, jsonify, request

analysis_bp = Blueprint("analysis", __name__, url_prefix="/api/analysis")


@analysis_bp.post("/compare")
def compare_textbooks():
    payload = request.get_json(silent=True) or {}
    textbook_ids = payload.get("textbook_ids") or []
    textbook_service = current_app.config["services"]["textbook"]
    service = current_app.config["services"]["analysis"]
    textbooks = textbook_service.get_textbooks_by_ids(textbook_ids)
    return jsonify(service.compare_textbooks(textbooks))
