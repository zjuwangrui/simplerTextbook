from server import create_app

app = create_app()


if __name__ == "__main__":
    settings = app.config["settings"]
    app.run(host=settings.app.host, port=settings.app.port, debug=False)
