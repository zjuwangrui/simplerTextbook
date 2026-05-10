from flask import Blueprint, current_app, jsonify, request

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


@reports_bp.get("")
def list_reports():
    service = current_app.config["services"]["report"]
    return jsonify({"items": service.list_reports()})


@reports_bp.post("/generate")
def generate_report():
    payload = request.get_json(silent=True) or {}
    textbook_ids = payload.get("textbook_ids") or []

    textbook_service = current_app.config["services"]["textbook"]
    dialogue_service = current_app.config["services"]["dialogue"]
    service = current_app.config["services"]["report"]

    textbooks = textbook_service.get_textbooks_by_ids(textbook_ids)
    history = dialogue_service.list_history()
    return jsonify(service.generate_report(textbooks, history))
