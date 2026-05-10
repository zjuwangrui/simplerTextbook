from flask import Blueprint, current_app, jsonify, request

graphs_bp = Blueprint("graphs", __name__, url_prefix="/api/graphs")


@graphs_bp.get("/textbooks/<textbook_id>")
def get_textbook_graph(textbook_id: str):
    service = current_app.config["services"]["textbook"]
    detail = service.get_textbook_detail(textbook_id)
    return jsonify(detail["graph"])


@graphs_bp.post("/combined")
def get_combined_graph():
    payload = request.get_json(silent=True) or {}
    textbook_ids = payload.get("textbook_ids") or []
    textbook_service = current_app.config["services"]["textbook"]
    analysis_service = current_app.config["services"]["analysis"]
    textbooks = textbook_service.get_textbooks_by_ids(textbook_ids)
    return jsonify(analysis_service.build_combined_graph(textbooks))
