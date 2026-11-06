#!/usr/bin/env python3
"""Call bot for the Galaxy S10 GSM phone (modem SIM) driven over adb,
with call audio through the Bluetooth hands-free link (BlueALSA hfp-hf).

  callbot.py answer --text "..." [--rings-wait 4]   wait for an incoming call, answer, speak, beep, record
  callbot.py dial <number> --text "..."             call out, speak when answered, beep, record
  callbot.py listen                                 answer every incoming call with greeting.txt (systemd)

Each call leaves in ~/speech/calls/<ts>-<dir>-<number>/:
  greeting.wav (what we said), caller.wav (the other party), conversation.wav (both mixed),
  transcript.txt (local faster-whisper, Hungarian), meta.json
"""
import argparse, json, os, re, signal, subprocess, sys, time
from datetime import datetime

SERIAL = "RF8M2101WXX"
ADB = os.path.expanduser("~/Android/platform-tools/adb")
BT_MAC = "CC:21:19:D5:B3:F4"
PCM = f"bluealsa:DEV={BT_MAC},PROFILE=sco"
RATE = 16000
VENV_PY = os.path.expanduser("~/speech-venv/bin/python")
PIPER_VOICE = os.path.expanduser("~/speech/voices/hu_HU-anna-medium.onnx")
CALLS_DIR = os.path.expanduser("~/speech/calls")
MAX_RECORD_S = 120

# android.telephony.PreciseCallState
P_IDLE, P_ACTIVE, P_DIALING, P_ALERTING, P_INCOMING, P_DISCONNECTED = 0, 1, 3, 4, 5, 7


def adb(*args, timeout=15):
    return subprocess.run([ADB, "-s", SERIAL, "shell", *args], capture_output=True,
                          text=True, timeout=timeout).stdout


def call_state():
    """Returns (call_state, ringing_precise, foreground_precise, incoming_number)."""
    out = adb("dumpsys", "telephony.registry")
    cs = re.search(r"mCallState=(\d+)", out)
    ring = re.search(r"Ringing call state: (-?\d+)", out)
    fg = re.search(r"Foreground call state: (-?\d+)", out)
    num = re.search(r"mCallIncomingNumber=(\S*)", out)
    return (int(cs.group(1)) if cs else 0, int(ring.group(1)) if ring else -1,
            int(fg.group(1)) if fg else -1, num.group(1) if num else "")


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def tts(text, out_wav):
    raw = out_wav + ".raw.wav"
    subprocess.run([VENV_PY, "-m", "piper", "-m", PIPER_VOICE, "-f", raw],
                   input=text, text=True, check=True, capture_output=True)
    # Resample to the SCO rate, add a short lead-in and a beep at the end.
    beep = out_wav + ".beep.wav"
    subprocess.run(["sox", "-n", "-r", str(RATE), "-c", "1", "-b", "16", beep,
                    "synth", "0.4", "sine", "1000", "vol", "0.5"], check=True)
    subprocess.run(["sox", raw, "-r", str(RATE), "-c", "1", "-b", "16", out_wav + ".body.wav"], check=True)
    subprocess.run(["sox", out_wav + ".body.wav", beep, out_wav, "pad", "0.5", "0.2"], check=True)
    for f in (raw, beep, out_wav + ".body.wav"):
        os.remove(f)


def wav_seconds(path):
    return float(subprocess.run(["soxi", "-D", path], capture_output=True, text=True).stdout.strip() or 0)


def run_call(direction, number, text, ended):
    """Called once the call is ACTIVE: speak, beep, record until hangup/limit."""
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    d = os.path.join(CALLS_DIR, f"{ts}-{direction}-{re.sub(r'[^0-9+]', '', number) or 'unknown'}")
    os.makedirs(d, exist_ok=True)
    greeting = os.path.join(d, "greeting.wav")
    caller = os.path.join(d, "caller.wav")
    tts(text, greeting)
    t0 = time.time()
    rec = subprocess.Popen(["arecord", "-q", "-D", PCM, "-f", "S16_LE", "-c", "1", "-r", str(RATE), caller])
    time.sleep(0.8)  # let the SCO link come up
    play_offset = time.time() - t0
    log(f"speaking ({wav_seconds(greeting):.1f}s)")
    subprocess.run(["aplay", "-q", "-D", PCM, greeting])
    log("recording")
    while time.time() - t0 < MAX_RECORD_S and not ended():
        time.sleep(0.5)
    hung_up_by_us = not ended()
    if hung_up_by_us:
        adb("input", "keyevent", "KEYCODE_ENDCALL")
    time.sleep(0.5)
    rec.send_signal(signal.SIGINT)  # SIGINT lets arecord finalize the WAV header
    rec.wait(timeout=5)
    conv = os.path.join(d, "conversation.wav")
    subprocess.run(["sox", "-m", caller, "|sox " + greeting + f" -p pad {play_offset:.2f}", conv], check=False)
    meta = {"direction": direction, "number": number, "started": ts, "text": text,
            "duration_s": round(time.time() - t0, 1), "hung_up_by_us": hung_up_by_us}
    log("transcribing")
    tr = subprocess.run([VENV_PY, os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcribe.py"), caller],
                        capture_output=True, text=True)
    with open(os.path.join(d, "transcript.txt"), "w") as f:
        f.write(tr.stdout.strip() + "\n")
    with open(os.path.join(d, "meta.json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    log(f"done: {d}")
    print(tr.stdout.strip())
    return d


def ensure_bt():
    """Reconnect the hands-free link if the phone dropped it (reboot, BT toggle)."""
    info = subprocess.run(["bluetoothctl", "info", BT_MAC], capture_output=True, text=True).stdout
    if "Connected: yes" not in info:
        log("bluetooth link down, reconnecting")
        subprocess.run(["bluetoothctl", "connect", BT_MAC], capture_output=True, text=True, timeout=30)


def cmd_answer(a):
    log("waiting for an incoming call")
    last_bt = 0.0
    while True:
        if time.time() - last_bt > 60:
            ensure_bt()
            last_bt = time.time()
        cs, ring, fg, num = call_state()
        if cs == 1:
            break
        time.sleep(0.5)
    log(f"ringing from {num or 'unknown'}; answering in {a.rings_wait}s")
    time.sleep(a.rings_wait)
    adb("input", "keyevent", "KEYCODE_CALL")
    for _ in range(20):
        cs, ring, fg, _n = call_state()
        if fg == P_ACTIVE:
            break
        time.sleep(0.5)
    else:
        log("call did not become active")
        return
    run_call("in", num, a.text, lambda: call_state()[0] == 0)


def cmd_dial(a):
    log(f"dialing {a.number}")
    adb("am", "start", "-a", "android.intent.action.CALL", "-d", f"tel:{a.number}")
    deadline = time.time() + 60
    while time.time() < deadline:
        cs, ring, fg, _n = call_state()
        if fg == P_ACTIVE:
            break
        if cs == 0 and time.time() > deadline - 55:
            log("call ended before answer")
            return
        time.sleep(0.5)
    else:
        adb("input", "keyevent", "KEYCODE_ENDCALL")
        log("no answer")
        return
    run_call("out", a.number, a.text, lambda: call_state()[0] == 0)


GREETING_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "greeting.txt")


def cmd_listen(a):
    """Answer every incoming call with the owner-approved greeting, forever."""
    text = open(GREETING_FILE, encoding="utf-8").read().strip()
    while True:
        try:
            a.text = text
            cmd_answer(a)
        except Exception as e:  # keep listening; a single bad call must not stop the bot
            log(f"error: {e!r}")
        # wait until the line is idle again before arming for the next call
        while True:
            try:
                if call_state()[0] == 0:
                    break
            except Exception:
                pass
            time.sleep(1)


def main():
    p = argparse.ArgumentParser()
    sp = p.add_subparsers(dest="cmd", required=True)
    pa = sp.add_parser("answer"); pa.add_argument("--text", required=True); pa.add_argument("--rings-wait", type=float, default=4)
    pl = sp.add_parser("listen"); pl.add_argument("--rings-wait", type=float, default=4)
    pd = sp.add_parser("dial"); pd.add_argument("number"); pd.add_argument("--text", required=True)
    a = p.parse_args()
    {"answer": cmd_answer, "dial": cmd_dial, "listen": cmd_listen}[a.cmd](a)


if __name__ == "__main__":
    main()
