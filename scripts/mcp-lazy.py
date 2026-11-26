#!/usr/bin/env python3
"""mcp-lazy.py — start a stdio MCP server only when a session actually USES it.

Why (owner decision 2026-11-26, brief cit-bongeszo-mcp-csak-agenseknek-20261126.md):
every Claude Code session in the citoviso repo (main tree AND every ~/wt/cit<id>
worktree — they all share the ~/.claude.json project entry of the main repo)
spawned chrome-devtools-mcp twice plus openstreetmap-mcp-server at start-up:
45 servers, ~9.2 GB RSS+swap, of which ONE had a browser. Transcripts of the last
15 days show ~12 sessions calling these tools at all. A static per-session list
would break the ad-hoc dev sessions that do need a browser, and the watchdog
RESUME / HARD-RESTART path passes no extra --mcp-config, so the gate must live in
the shared config itself: this proxy.

How: the CLI talks to this small process instead of the real server.
  * initialize / tools/list / ping are answered from a cache captured the last
    time the real server ran (per server name, ~/.cache/citoviso-mcp-lazy/).
  * The first other request (tools/call, resources/*, ...) spawns the real server,
    replays the client's own initialize + initialized to it, refreshes the cache,
    and from then on the proxy is a transparent line pipe in both directions.
  * With no cache yet (first ever run, or command changed) the real server starts
    immediately and the cache is filled — so the proxy can never answer with a
    tool list it has not seen from the real server.
  * "{cwd}" in an argument is replaced by the session's working directory
    (e.g. chrome-devtools-mcp --workspace {cwd}: screenshots may be saved into
    the session's own tree instead of a long-deleted one).

⛔ Never kill the REAL server under a live session either: the CLI does not
restart a dead stdio MCP server (measured 2026-11-26, CLI 2.1.332). If the real
server exits, this proxy exits with it, exactly as before.

Usage (in ~/.claude.json mcpServers):
  "command": "python3",
  "args": ["/home/citoviso/citoviso/scripts/mcp-lazy.py", "--name", "chrome-devtools",
           "--", "npx", "-y", "chrome-devtools-mcp@latest", ...]
Self-test: python3 scripts/mcp-lazy.py --selftest
"""
import hashlib
import json
import os
import subprocess
import sys
import threading

CACHE_DIR = os.path.expanduser(os.environ.get("MCP_LAZY_CACHE", "~/.cache/citoviso-mcp-lazy"))
INIT_ID = "mcp-lazy-init"
TOOLS_ID = "mcp-lazy-tools"
# logging/setLevel: the CLI may send it right after the handshake; answering it here
# keeps a session that never calls a tool from starting the real server.
LOCAL_METHODS = {"initialize", "tools/list", "ping", "logging/setLevel"}


def log(msg):
    try:
        sys.stderr.write(f"[mcp-lazy] {msg}\n")
        sys.stderr.flush()
    except Exception:
        pass


class Proxy:
    def __init__(self, name, cmd, stdin=None, stdout=None):
        self.name = name
        self.cmd = [a.replace("{cwd}", os.getcwd()) for a in cmd]
        # Key the cache by the configured command (before {cwd} expansion), so a
        # config change never serves a stale tool list but worktrees share one.
        key = hashlib.sha1(json.dumps(cmd).encode()).hexdigest()[:12]
        safe = "".join(c for c in name if c.isalnum() or c in "-_") or "server"
        self.cache_path = os.path.join(CACHE_DIR, f"{safe}-{key}.json")
        self.stdin = stdin or sys.stdin.buffer
        self.stdout = stdout or sys.stdout.buffer
        self.out_lock = threading.Lock()
        self.real = None
        self.client_init = None
        self.client_initialized = False
        self.cache = self._load_cache()
        self.pending_internal = {}
        self.cold_tools_ids = set()

    # ---- cache -------------------------------------------------------------
    def _load_cache(self):
        try:
            with open(self.cache_path) as f:
                c = json.load(f)
            if isinstance(c.get("initialize"), dict) and isinstance(c.get("tools"), dict):
                return c
        except Exception:
            pass
        return None

    def _save_cache(self, init_result, tools_result):
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            tmp = f"{self.cache_path}.{os.getpid()}.tmp"
            with open(tmp, "w") as f:
                json.dump({"initialize": init_result, "tools": tools_result}, f)
            os.replace(tmp, self.cache_path)
            self.cache = {"initialize": init_result, "tools": tools_result}
        except Exception as e:
            log(f"cache write failed: {e}")

    # ---- io ----------------------------------------------------------------
    def send_client(self, obj):
        data = (json.dumps(obj, separators=(",", ":")) + "\n").encode()
        with self.out_lock:
            self.stdout.write(data)
            self.stdout.flush()

    def send_real(self, raw):
        if not raw.endswith(b"\n"):
            raw += b"\n"
        self.real.stdin.write(raw)
        self.real.stdin.flush()

    # ---- real server -------------------------------------------------------
    def start_real(self):
        if self.real is not None:
            return
        log(f"{self.name}: starting real server")
        self.real = subprocess.Popen(self.cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        init_params = (self.client_init or {}).get("params") or {
            "protocolVersion": "2025-06-18", "capabilities": {},
            "clientInfo": {"name": "mcp-lazy", "version": "1"}}
        # Handshake with our own ids; responses are swallowed by the pump.
        init_done = threading.Event()
        self.pending_internal[INIT_ID] = ("init", init_done)
        threading.Thread(target=self.pump_real, daemon=True).start()
        self.send_real(json.dumps({"jsonrpc": "2.0", "id": INIT_ID, "method": "initialize",
                                   "params": init_params}).encode())
        if not init_done.wait(120):
            log(f"{self.name}: real server did not answer initialize in 120s")
        self.send_real(b'{"jsonrpc":"2.0","method":"notifications/initialized"}')
        self.pending_internal[TOOLS_ID] = ("tools", None)
        self.send_real(json.dumps({"jsonrpc": "2.0", "id": TOOLS_ID, "method": "tools/list",
                                   "params": {}}).encode())

    def pump_real(self):
        init_result = None
        for raw in self.real.stdout:
            try:
                msg = json.loads(raw)
            except Exception:
                msg = None
            mid = msg.get("id") if isinstance(msg, dict) else None
            if mid in self.pending_internal and ("result" in msg or "error" in msg):
                kind, ev = self.pending_internal.pop(mid)
                if kind == "init":
                    init_result = msg.get("result")
                    if ev:
                        ev.set()
                elif kind == "tools" and init_result and isinstance(msg.get("result"), dict) \
                        and not msg["result"].get("nextCursor"):
                    self._save_cache(init_result, msg["result"])
                continue
            with self.out_lock:
                self.stdout.write(raw if raw.endswith(b"\n") else raw + b"\n")
                self.stdout.flush()
        code = self.real.wait()
        log(f"{self.name}: real server exited ({code})")
        os._exit(code if code is not None else 1)

    # ---- client side -------------------------------------------------------
    def answer_locally(self, msg):
        method, mid = msg.get("method"), msg.get("id")
        if method == "initialize":
            self.client_init = msg
            res = dict(self.cache["initialize"])
            self.send_client({"jsonrpc": "2.0", "id": mid, "result": res})
        elif method == "tools/list":
            self.send_client({"jsonrpc": "2.0", "id": mid, "result": self.cache["tools"]})
        elif method in ("ping", "logging/setLevel"):
            self.send_client({"jsonrpc": "2.0", "id": mid, "result": {}})

    def run(self):
        if self.cache is None:
            # Nothing seen yet: be a plain pipe and let the real server fill the cache.
            first = True
            for raw in self.stdin:
                try:
                    m = json.loads(raw)
                except Exception:
                    m = None
                if isinstance(m, dict) and "id" in m:
                    if m.get("method") == "initialize":
                        self.client_init = m
                    elif m.get("method") == "tools/list" and not (m.get("params") or {}).get("cursor"):
                        self.cold_tools_ids.add(m["id"])
                if first:
                    self._start_passthrough_with_capture()
                    first = False
                self.send_real(raw)
            self._close()
            return
        for raw in self.stdin:
            if self.real is not None:
                self.send_real(raw)
                continue
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            method = msg.get("method") if isinstance(msg, dict) else None
            if method is None:
                continue  # a response to a server request we never made
            if method in LOCAL_METHODS and not (method == "tools/list" and (msg.get("params") or {}).get("cursor")):
                self.answer_locally(msg)
                continue
            if method == "notifications/initialized":
                self.client_initialized = True
                continue
            if "id" not in msg:
                continue  # other notifications (cancelled, roots changed) are moot before start
            self.start_real()
            self.send_real(raw)
        self._close()

    def _start_passthrough_with_capture(self):
        # Cold start: forward everything, and additionally capture tools/list for the cache.
        log(f"{self.name}: no cache, starting real server now")
        self.real = subprocess.Popen(self.cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
        init_id = (self.client_init or {}).get("id")
        state = {"init": None}

        def pump():
            for raw in self.real.stdout:
                try:
                    msg = json.loads(raw)
                except Exception:
                    msg = None
                if isinstance(msg, dict) and "method" not in msg:
                    mid = msg.get("id")
                    if init_id is not None and mid == init_id and "result" in msg:
                        state["init"] = msg["result"]
                    elif mid in self.cold_tools_ids and state["init"] \
                            and isinstance(msg.get("result"), dict) and not msg["result"].get("nextCursor"):
                        self._save_cache(state["init"], msg["result"])
                with self.out_lock:
                    self.stdout.write(raw if raw.endswith(b"\n") else raw + b"\n")
                    self.stdout.flush()
            code = self.real.wait()
            log(f"{self.name}: real server exited ({code})")
            os._exit(code if code is not None else 1)

        threading.Thread(target=pump, daemon=True).start()

    def _close(self):
        # Client went away: close the real server's stdin and let it exit on its own.
        if self.real is not None:
            try:
                self.real.stdin.close()
            except Exception:
                pass
            try:
                code = self.real.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.real.terminate()
                code = self.real.wait()
            os._exit(code or 0)
        os._exit(0)


FAKE_SERVER = r'''
import json, sys, os
started = os.environ.get("FAKE_MARK")
if started:
    open(started, "a").write("x")
for line in sys.stdin:
    m = json.loads(line)
    if "id" not in m:
        continue
    if m["method"] == "initialize":
        r = {"protocolVersion": "2025-06-18", "capabilities": {"tools": {}}, "serverInfo": {"name": "fake", "version": "1"}}
    elif m["method"] == "tools/list":
        r = {"tools": [{"name": "echo", "inputSchema": {"type": "object"}}]}
    elif m["method"] == "tools/call":
        r = {"content": [{"type": "text", "text": "pong:" + json.dumps(m["params"])}]}
    else:
        r = {}
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": m["id"], "result": r}) + "\n"); sys.stdout.flush()
'''


def selftest():
    import tempfile, time
    tmp = tempfile.mkdtemp(prefix="mcp-lazy-selftest-")
    fake = os.path.join(tmp, "fake.py")
    open(fake, "w").write(FAKE_SERVER)
    mark = os.path.join(tmp, "started")
    env = dict(os.environ, MCP_LAZY_CACHE=os.path.join(tmp, "cache"), FAKE_MARK=mark)
    me = os.path.abspath(__file__)

    def session(lines, wait_ids):
        p = subprocess.Popen([sys.executable, me, "--name", "fake", "--", sys.executable, fake],
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)
        got = {}
        for ln in lines:
            p.stdin.write((json.dumps(ln) + "\n").encode()); p.stdin.flush()
            if "id" in ln and ln["id"] in wait_ids:
                resp = json.loads(p.stdout.readline())
                got[resp["id"]] = resp
            time.sleep(0.05)
        time.sleep(0.2)
        p.stdin.close(); p.wait(timeout=15)
        return got

    init = {"jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "1"}}}
    note = {"jsonrpc": "2.0", "method": "notifications/initialized"}
    tl = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
    call = {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "echo", "arguments": {"a": 1}}}
    ok = True

    def check(cond, label):
        nonlocal ok
        print(("PASS " if cond else "FAIL ") + label)
        ok = ok and cond

    # 1) cold: passthrough, cache gets written
    g = session([init, note, tl], {1, 2})
    check(g.get(2, {}).get("result", {}).get("tools", [{}])[0].get("name") == "echo", "cold start answers tools/list")
    check(bool(os.listdir(env["MCP_LAZY_CACHE"])), "cold start wrote the cache")
    os.remove(mark)
    # 2) warm, no tool call: real server must NOT start
    g = session([init, note, tl], {1, 2})
    check(g.get(1, {}).get("result", {}).get("serverInfo", {}).get("name") == "fake", "warm initialize from cache")
    check(g.get(2, {}).get("result", {}).get("tools", [{}])[0].get("name") == "echo", "warm tools/list from cache")
    check(not os.path.exists(mark), "warm session without a call never starts the real server")
    # 3) warm + call: real server starts, call answered with the client's own id
    g = session([init, note, tl, call], {1, 2, 3})
    txt = g.get(3, {}).get("result", {}).get("content", [{}])[0].get("text", "")
    check(txt.startswith("pong:") and '"a": 1' in txt, "first tools/call starts the real server and is answered")
    check(os.path.exists(mark), "real server started exactly when needed")
    print("SELFTEST " + ("OK" if ok else "FAILED"))
    return 0 if ok else 1


def main(argv):
    if argv[:1] == ["--selftest"]:
        return selftest()
    if len(argv) < 4 or argv[0] != "--name" or argv[2] != "--":
        sys.stderr.write("usage: mcp-lazy.py --name <server> -- <command> [args...]\n")
        return 2
    Proxy(argv[1], argv[3:]).run()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
