from flask import Blueprint, current_app, jsonify, request

integration_bp = Blueprint("integration", __name__, url_prefix="/api/integration")


@integration_bp.post("/generate")
def generate_integration():
    payload = request.get_json(silent=True) or {}
    textbook_ids = payload.get("textbook_ids") or []
    ratio = float(payload.get("ratio", 0.3))

    textbook_service = current_app.config["services"]["textbook"]
    service = current_app.config["services"]["integration"]
    textbooks = textbook_service.get_textbooks_by_ids(textbook_ids)
    return jsonify(service.generate_summary(textbooks, ratio))
