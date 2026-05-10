from flask import Blueprint, current_app, jsonify, request

graphs_bp = Blueprint("graphs", __name__, url_prefix="/api/graphs")


@graphs_bp.get("/textbooks/<textbook_id>")
def get_textbook_graph(textbook_id: str):
    service = current_app.config["services"]["textbook"]
    return jsonify(service.get_graph_payload(textbook_id))


@graphs_bp.get("/textbooks/<textbook_id>/status")
def get_textbook_graph_status(textbook_id: str):
    service = current_app.config["services"]["textbook"]
    return jsonify(service.get_graph_status(textbook_id))


@graphs_bp.post("/textbooks/<textbook_id>/generate")
def generate_textbook_graph(textbook_id: str):
    service = current_app.config["services"]["textbook"]
    return jsonify(service.enqueue_graph_generation(textbook_id)), 202


@graphs_bp.post("/combined")
def get_combined_graph():
    payload = request.get_json(silent=True) or {}
    textbook_ids = payload.get("textbook_ids") or []
    textbook_service = current_app.config["services"]["textbook"]
    analysis_service = current_app.config["services"]["analysis"]
    textbooks = textbook_service.get_textbooks_by_ids(textbook_ids)
    return jsonify(analysis_service.build_combined_graph(textbooks))
