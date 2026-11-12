"""Start the local album workshop using only Python's standard library."""
import functools
import http.server
from pathlib import Path
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
with http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
    url = f'http://127.0.0.1:{server.server_port}'
    print(f'Album workshop: {url}\nKeep this window open. Press Ctrl+C to stop.', flush=True)
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
