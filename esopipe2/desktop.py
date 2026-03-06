import os
import sys
import threading
import uvicorn
import socket
import time
import subprocess
import urllib.request
import traceback

from esopipe2.server import app, get_app_data_dir

# Setup logging
log_dir = os.path.join(get_app_data_dir(), "logs")
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, "launcher.log")


def log(msg):
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")


def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def run_server(port):
    log(f"Starting uvicorn on port {port}...")
    try:
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="error")
    except Exception as e:
        log(f"UVICORN ERROR: {e}\n{traceback.format_exc()}")


def wait_for_health(port, timeout=20):
    url = f"http://127.0.0.1:{port}/health"
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1) as r:
                if r.status == 200:
                    log(f"Server ready at {url}")
                    return True
        except Exception:
            pass
        time.sleep(0.4)
    log(f"Server not ready after {timeout}s")
    return False


def find_app_browser():
    """Return path to Edge or Chrome that supports --app= flag."""
    candidates = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


if __name__ == "__main__":
    log("=== EsoPipe Studio starting ===")

    port = get_free_port()

    # Start FastAPI server in a daemon thread
    t = threading.Thread(target=run_server, args=(port,), daemon=True)
    t.start()

    if not wait_for_health(port):
        log("Server failed to start — aborting.")
        sys.exit(1)

    url = f"http://127.0.0.1:{port}"
    browser = find_app_browser()

    if browser:
        log(f"Launching app window via {browser}")
        proc = subprocess.Popen([
            browser,
            f"--app={url}",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
        ])
        log(f"Window PID {proc.pid} — waiting for close")
        proc.wait()
        log("Window closed — shutting down.")
    else:
        # Fallback: open default browser and keep server alive until Ctrl-C
        log("Edge/Chrome not found — opening default browser.")
        import webbrowser
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass

    log("EsoPipe Studio exiting.")
    sys.exit(0)
