from flask import Flask, jsonify
from flask_cors import CORS

from .api.routes.analysis import analysis_bp
from .api.routes.dialogue import dialogue_bp
from .api.routes.graphs import graphs_bp
from .api.routes.health import health_bp
from .api.routes.integration import integration_bp
from .api.routes.qa import qa_bp
from .api.routes.reports import reports_bp
from .api.routes.textbooks import textbooks_bp
from .clients.llm_client import OpenAICompatibleClient
from .core.config import load_settings
from .core.errors import AppError
from .core.logging import configure_logging
from .repositories.conversation_repository import ConversationRepository
from .repositories.report_repository import ReportRepository
from .repositories.textbook_repository import TextbookRepository
from .services.analysis_service import AnalysisService
from .services.dialogue_service import DialogueService
from .services.graph_service import GraphService
from .services.integration_service import IntegrationService
from .services.qa_service import QAService
from .services.report_service import ReportService
from .services.textbook_service import TextbookService


def create_app() -> Flask:
    settings = load_settings()
    settings.ensure_directories()

    app = Flask(__name__)
    app.config["settings"] = settings

    configure_logging(app, settings)
    CORS(app, resources={r"/api/*": {"origins": settings.app.cors_origins}})

    textbook_repository = TextbookRepository(settings.storage)
    conversation_repository = ConversationRepository(settings.storage)
    report_repository = ReportRepository(settings.storage)
    llm_client = OpenAICompatibleClient(settings.llm)

    graph_service = GraphService(settings.processing)
    analysis_service = AnalysisService(graph_service)
    integration_service = IntegrationService(settings.processing)
    textbook_service = TextbookService(
        repository=textbook_repository,
        graph_service=graph_service,
        processing_settings=settings.processing,
    )
    qa_service = QAService(settings.rag, llm_client)
    dialogue_service = DialogueService(
        repository=conversation_repository,
        llm_client=llm_client,
        analysis_service=analysis_service,
        integration_service=integration_service,
    )
    report_service = ReportService(
        repository=report_repository,
        analysis_service=analysis_service,
        integration_service=integration_service,
    )

    app.config["services"] = {
        "textbook": textbook_service,
        "analysis": analysis_service,
        "integration": integration_service,
        "qa": qa_service,
        "dialogue": dialogue_service,
        "report": report_service,
        "textbook_repository": textbook_repository,
        "llm_client": llm_client,
    }

    register_blueprints(app)
    register_error_handlers(app)
    return app


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(health_bp)
    app.register_blueprint(textbooks_bp)
    app.register_blueprint(graphs_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(integration_bp)
    app.register_blueprint(qa_bp)
    app.register_blueprint(dialogue_bp)
    app.register_blueprint(reports_bp)


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(AppError)
    def handle_app_error(error: AppError):
        payload = {
            "error": {
                "message": error.message,
                "details": error.details,
            }
        }
        return jsonify(payload), error.status_code

    @app.errorhandler(404)
    def handle_not_found(_error):
        return jsonify({"error": {"message": "接口不存在。", "details": {}}}), 404

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        app.logger.exception("Unhandled server error: %s", error)
        return jsonify({"error": {"message": "服务内部错误。", "details": {}}}), 500
