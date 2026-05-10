from flask import Blueprint, current_app, jsonify

health_bp = Blueprint("health", __name__, url_prefix="/api")


@health_bp.get("/health")
def health_check():
    repository = current_app.config["services"]["textbook_repository"]
    settings = current_app.config["settings"]
    return jsonify(
        {
            "status": "ok",
            "textbook_count": len(repository.list_textbooks()),
            "llm_enabled": settings.llm.enabled and bool(settings.llm.api_key),
        }
    )
