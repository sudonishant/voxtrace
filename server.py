#!/usr/bin/env python3
"""VOXTRACE static server — sends no-cache headers so previews are never stale."""
import http.server, functools

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
    def log_message(self, fmt, *args):
        pass  # quiet logs

import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", 3000))

handler = functools.partial(NoCacheHandler, directory=SCRIPT_DIR)
print(f"Starting VOXTRACE server on port {PORT} (serving {SCRIPT_DIR})...")
http.server.ThreadingHTTPServer(("0.0.0.0", PORT), handler).serve_forever()
