import os
import socket
import threading

# WORKAROUND: Ensures Nuitka includes the necessary plugins
import rdflib.plugins.parsers.hext  # noqa: F401
import rdflib.plugins.parsers.jsonld  # noqa: F401
import rdflib.plugins.parsers.notation3  # noqa: F401
import rdflib.plugins.parsers.nquads  # noqa: F401
import rdflib.plugins.parsers.ntriples  # noqa: F401
import rdflib.plugins.parsers.patch  # noqa: F401
import rdflib.plugins.parsers.RDFVOC  # noqa: F401
import rdflib.plugins.parsers.rdfxml  # noqa: F401
import rdflib.plugins.parsers.trig  # noqa: F401
import rdflib.plugins.parsers.trix  # noqa: F401
import rdflib.plugins.serializers.hext  # noqa: F401
import rdflib.plugins.serializers.jsonld  # noqa: F401
import rdflib.plugins.serializers.longturtle  # noqa: F401
import rdflib.plugins.serializers.n3  # noqa: F401
import rdflib.plugins.serializers.nquads  # noqa: F401
import rdflib.plugins.serializers.nt  # noqa: F401
import rdflib.plugins.serializers.patch  # noqa: F401
import rdflib.plugins.serializers.rdfxml  # noqa: F401
import rdflib.plugins.serializers.trig  # noqa: F401
import rdflib.plugins.serializers.trix  # noqa: F401
import rdflib.plugins.serializers.turtle  # noqa: F401
import rdflib.plugins.serializers.xmlwriter  # noqa: F401
import rdflib.plugins.sparql.aggregates  # noqa: F401
import rdflib.plugins.sparql.algebra  # noqa: F401
import rdflib.plugins.sparql.datatypes  # noqa: F401
import rdflib.plugins.sparql.evaluate  # noqa: F401
import rdflib.plugins.sparql.evalutils  # noqa: F401
import rdflib.plugins.sparql.operators  # noqa: F401
import rdflib.plugins.sparql.parser  # noqa: F401
import rdflib.plugins.sparql.parserutils  # noqa: F401
import rdflib.plugins.sparql.processor  # noqa: F401
import rdflib.plugins.sparql.sparql  # noqa: F401
import rdflib.plugins.sparql.update  # noqa: F401
import rdflib.plugins.stores.memory  # noqa: F401

# WORKAROUND: Ensures Nuitka includes the necessary plugins
import webview
from dotenv import load_dotenv
from kink.container import di
from pydantic import parse_obj_as

from server.logger import setup_logging
from server.server import app

load_dotenv()

DEBUG = bool(os.getenv("DEBUG", False))

os.environ["DD_TRACE_ENABLED"] = os.getenv("DD_TRACE_ENABLED", "false")

thread = None

LOG_JSON_FORMAT = parse_obj_as(bool, os.getenv("LOG_JSON_FORMAT", False))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
setup_logging(json_logs=LOG_JSON_FORMAT, log_level=LOG_LEVEL)


def get_free_port():
    BIND_INTERFACE = os.getenv("BIND_INTERFACE", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(
                    (BIND_INTERFACE, port)
                )  # Bind to the port on all network interfaces
                s.listen(1)  # Start listening to check if the port is available
                return port  # If binding succeeds, the port is free
            except OSError:
                port += 1  # If binding fails, try the next port
                continue


port = 8000 if DEBUG else get_free_port()

di["PORT"] = port


def start_fastapi():
    import uvicorn

    # DO NOT Serve on 0.0.0.0, Windows will show firewall prompt on every launch
    uvicorn.run(app, host="127.0.0.1", port=port, log_config=None)


def on_closing():
    global thread
    if thread:
        thread.join(timeout=0)
    os._exit(0)


if __name__ == "__main__":
    if DEBUG:
        start_fastapi()
    else:
        # Run server in separate thread
        thread = threading.Thread(target=start_fastapi)
        thread.start()
        # Create window
        window = webview.create_window(
            "RDFCraft",
            f"http://127.0.0.1:{port}",
            min_size=(800, 600),
            resizable=True,
        )
        window.events.closing += on_closing
        webview.settings["ALLOW_DOWNLOADS"] = True
        webview.start()
