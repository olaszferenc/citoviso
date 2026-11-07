#!/usr/bin/env python3
"""S10 messenger-first sender (ADR-XXXX): Viber -> WhatsApp -> MMS, one image + one text.

  s10_send.py presence --to 36301234567
  s10_send.py send --to 36301234567 --image kep.jpg --text "..." [--channel auto|viber|whatsapp|mms] [--dry-run]
  s10_send.py status --to 36301234567 --channel whatsapp|viber

Prints ONE JSON line. Exit 0 = the message is visible as sent in the chosen app; exit 1 = not sent.
UI rules: WhatsApp drops injected input -> clicks/text go through the accessibility bridge
(com.citoviso.a11y, scripts/s10-a11y). The screen is exclusive: flock ~/.cache/s10-ui.lock, and
nothing is touched while a call is ringing or active (citoviso-callbot owns calls).
"""
import argparse, fcntl, hashlib, json, os, re, subprocess, sys, time
from datetime import date

SER = os.environ.get("ADB_SERIAL", "RF8M2101WXX")
ADB = [os.path.expanduser("~/Android/platform-tools/adb"), "-s", SER]
LOCK = os.path.expanduser("~/.cache/s10-ui.lock")
VIBER_FRESH_DAYS = 30
MONTHS = ["január", "február", "március", "április", "május", "június", "július",
          "augusztus", "szeptember", "október", "november", "december"]


class Fail(Exception):
    pass


def sh(*a, timeout=30):
    return subprocess.run(ADB + ["shell", *a], capture_output=True, text=True, timeout=timeout).stdout


def dump():
    sh("uiautomator", "dump", "/sdcard/ui.xml")
    return sh("cat", "/sdcard/ui.xml")


def text_of(x, rid):
    m = re.search(r'text="([^"]*)" resource-id="' + re.escape(rid) + '"', x)
    return m.group(1) if m else ""


def a11y(op, key, text=None):
    args = ["am", "broadcast", "-a", "com.citoviso.a11y.CMD", "--es", "op", op, "--es", "key", f"'{key}'"]
    if text is not None:
        args += ["--es", "text", "'" + text.replace("'", "'\\''") + "'"]
    out = sh(*args)
    return "-> true" in out


def wait_for(pred, tries=10, step=1.5):
    for _ in range(tries):
        time.sleep(step)
        x = dump()
        r = pred(x)
        if r:
            return x, r
    return dump(), None


def home():
    sh("input", "keyevent", "KEYCODE_HOME")


def call_busy():
    out = sh("dumpsys", "telephony.registry")
    ring = [int(v) for v in re.findall(r"Ringing call state: (-?\d+)", out)]
    fg = [int(v) for v in re.findall(r"Foreground call state: (-?\d+)", out)]
    # PreciseCallState: 1 active, 3 dialing, 4 alerting, 5 incoming
    return any(v in (1, 3, 4, 5) for v in ring + fg)


def norm(ph):
    d = re.sub(r"\D", "", ph)
    if d.startswith("06"):
        d = "36" + d[2:]
    if not re.fullmatch(r"36\d{8,9}", d):
        raise Fail(f"bad phone {ph!r}")
    return d


def viber_age_days(seen, today=None):
    """Days since last Viber activity from the chat subtitle; None = unknown/long ago."""
    today = today or date.today()
    s = seen.lower()
    if not s:
        return None
    if "elérhető" in s or "perce" in s or "órája" in s or " ma" in s or s.startswith("ma"):
        return 0
    if "tegnap" in s:
        return 1
    if "régen" in s:
        return None
    m = re.search(r"(" + "|".join(MONTHS) + r")\s+(\d{1,2})", s)
    if m:
        mon, day = MONTHS.index(m.group(1)) + 1, int(m.group(2))
        y = today.year if (mon, day) <= (today.month, today.day) else today.year - 1
        return (today - date(y, mon, day)).days
    return None


def presence_whatsapp(ph):
    sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"https://wa.me/{ph}", "-p", "com.whatsapp")
    x, r = wait_for(lambda x: "yes" if "com.whatsapp:id/conversation_contact_name" in x else
                    ("no" if re.search(r"nincsen regisztrálva a WhatsApp|nem használja a WhatsAppot|not on WhatsApp", x) else None))
    if r == "no":
        a11y("click", "android:id/button1")
    home()
    return r or "unknown"


def presence_viber(ph):
    sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"'viber://chat?number=%2B{ph}'")
    x, r = wait_for(lambda x: "no" if "nem elérhető" in x else ("yes" if "com.viber.voip:id/menu_viber_call" in x else None))
    name = seen = ""
    if r == "yes":
        time.sleep(2)
        y = dump()
        name, seen = text_of(y, "com.viber.voip:id/title"), text_of(y, "com.viber.voip:id/subtitle")
    elif r == "no":
        a11y("click", "android:id/button2")
    home()
    return r or "unknown", name, seen


def presence(ph):
    wa = presence_whatsapp(ph)
    time.sleep(3)
    vb, name, seen = presence_viber(ph)
    return {"whatsapp": wa, "viber": vb, "viber_name": name, "viber_last_seen": seen,
            "viber_age_days": viber_age_days(seen)}


def pick_channel(p):
    age = p["viber_age_days"]
    if p["viber"] == "yes" and age is not None and age <= VIBER_FRESH_DAYS:
        return "viber"
    if p["whatsapp"] == "yes":
        return "whatsapp"
    if p["viber"] == "yes":
        return "viber"
    return "mms"


def push_image(path):
    """Copy the image into the phone's MediaStore; returns (content_uri, display_name)."""
    data = open(path, "rb").read()
    name = "cit-" + hashlib.sha1(data).hexdigest()[:12] + ".jpg"
    dest = f"/sdcard/Pictures/citoviso-out/{name}"
    subprocess.run(ADB + ["shell", "mkdir", "-p", "/sdcard/Pictures/citoviso-out"], capture_output=True)
    subprocess.run(ADB + ["push", path, dest], capture_output=True, check=True)
    # Touch mtime so a freshly pushed copy is the newest image in every gallery.
    sh("touch", dest)
    sh("am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", f"file://{dest}")
    for _ in range(10):
        time.sleep(1)
        out = sh("content", "query", "--uri", "content://media/external/images/media",
                 "--projection", "_id", "--where", f"\"_display_name='{name}'\"")
        m = re.search(r"_id=(\d+)", out)
        if m:
            return f"content://media/external/images/media/{m.group(1)}", name
    raise Fail("image not indexed by MediaStore")


def send_whatsapp(ph, uri, text):
    sh("am", "start", "-a", "android.intent.action.SEND", "-t", "image/jpeg",
       "--eu", "android.intent.extra.STREAM", uri, "--es", "jid", f"{ph}@s.whatsapp.net",
       "--es", "android.intent.extra.TEXT", "'" + text.replace("'", "'\\''") + "'",
       "-p", "com.whatsapp", "--grant-read-uri-permission")
    x, ok = wait_for(lambda x: "com.whatsapp:id/send" in x and "caption" in x)
    if not ok:
        raise Fail("whatsapp: media preview did not open")
    if not a11y("click", "com.whatsapp:id/send"):
        raise Fail("whatsapp: send click failed")
    x, ok = wait_for(lambda x: "com.whatsapp:id/conversation_contact_name" in x and "com.whatsapp:id/status" in x, tries=12)
    if not ok:
        raise Fail("whatsapp: sent message not visible in chat")
    home()


def send_viber(ph, uri, text):
    sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"'viber://chat?number=%2B{ph}'")
    x, ok = wait_for(lambda x: "com.viber.voip:id/options_menu_open_gallery" in x)
    if not ok:
        raise Fail("viber: chat did not open")
    for k in ("com.viber.voip:id/close", "com.viber.voip:id/gotIt"):
        if k in x:
            a11y("click", k)
    a11y("click", "com.viber.voip:id/options_menu_open_gallery")
    time.sleep(2.5)
    # The in-chat gallery grid is not in the accessibility tree; cell 2 (after the camera
    # tile) is the newest image, which push_image() just created.
    m = re.search(r'resource-id="com.viber.voip:id/conversation_menu"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', dump())
    if not m:
        raise Fail("viber: gallery panel did not open")
    x1, y1, x2, _ = map(int, m.groups())
    cell = (x2 - x1) // 3
    sh("input", "tap", str(x1 + cell + cell // 2), str(y1 + 50 + cell // 2))
    for _ in range(3):  # promo sheets ("Kép újrakeverése" etc.) pop over the editor
        time.sleep(2)
        x = dump()
        if "com.viber.voip:id/bottom_sheet_title" in x or "Újrakeverés most" in x:
            sh("input", "keyevent", "KEYCODE_BACK")
            continue
        break
    x, ok = wait_for(lambda x: "Leírás hozzáadása" in x or "custom_cam_preview_media_description" in x, tries=6)
    if not ok:
        raise Fail("viber: image editor did not open")
    key = "com.viber.voip:id/custom_cam_preview_media_description"
    if key not in x:
        key = "~Leírás hozzáadása"
    if not a11y("settext", key, text):
        raise Fail("viber: caption could not be set")
    if not a11y("click", "com.viber.voip:id/btn_send"):
        raise Fail("viber: send click failed")
    snippet = text[:25]
    x, ok = wait_for(lambda x: snippet in x and "com.viber.voip:id/menu_viber_call" in x, tries=12)
    if not ok:
        raise Fail("viber: sent message not visible in chat")
    home()


def send_mms(ph, uri, text):
    sh("am", "start", "-a", "android.intent.action.SEND", "-t", "image/jpeg",
       "--eu", "android.intent.extra.STREAM", uri, "--es", "address", "0" + ph[2:],
       "--es", "sms_body", "'" + text.replace("'", "'\\''") + "'",
       "-n", "com.samsung.android.messaging/.ui.ComposeMessageMms", "--grant-read-uri-permission")
    x, ok = wait_for(lambda x: "com.samsung.android.messaging:id/send_button" in x)
    if not ok:
        sh("input", "keyevent", "KEYCODE_BACK")  # first-run tip popup
        x, ok = wait_for(lambda x: "com.samsung.android.messaging:id/send_button" in x)
    if not ok:
        raise Fail("mms: composer did not open")
    before = sh("content", "query", "--uri", "content://mms", "--projection", "_id", "--sort", "'_id DESC'").split("\n")[0]
    m = re.search(r'resource-id="com.samsung.android.messaging:id/send_button"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', x)
    if not a11y("click", "com.samsung.android.messaging:id/send_button") and m:
        a, b, c, d = map(int, m.groups())
        sh("input", "tap", str((a + c) // 2), str((b + d) // 2))
    for _ in range(40):  # MMS upload over mobile data takes 10-60 s
        time.sleep(2)
        top = sh("content", "query", "--uri", "content://mms", "--projection", "_id:msg_box:resp_st", "--sort", "'_id DESC'").split("\n")[0]
        if top != before and "msg_box=2" in top and "resp_st=128" in top:
            home()
            return
    raise Fail("mms: no successful send confirmation (resp_st=128) in 80 s")


def status(ph, channel):
    if channel == "whatsapp":
        sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"https://wa.me/{ph}", "-p", "com.whatsapp")
        x, _ = wait_for(lambda x: "com.whatsapp:id/conversation_contact_name" in x)
        sts = re.findall(r'resource-id="com.whatsapp:id/status"[^>]*content-desc="([^"]*)"', x)
        seen = text_of(x, "com.whatsapp:id/conversation_contact_status")
        replies = len(re.findall(r'resource-id="com.whatsapp:id/message_text"', x))
        home()
        return {"last_status": sts[-1] if sts else "", "last_seen": seen, "bubbles": replies}
    sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"'viber://chat?number=%2B{ph}'")
    x, _ = wait_for(lambda x: "com.viber.voip:id/menu_viber_call" in x)
    seen = text_of(x, "com.viber.voip:id/subtitle")
    home()
    return {"last_seen": seen}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["presence", "send", "status"])
    ap.add_argument("--to", required=True)
    ap.add_argument("--image")
    ap.add_argument("--text", default="")
    ap.add_argument("--channel", default="auto")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    res = {"ok": False, "cmd": a.cmd}
    try:
        ph = norm(a.to)
        res["to"] = ph
        os.makedirs(os.path.dirname(LOCK), exist_ok=True)
        lf = open(LOCK, "w")
        fcntl.flock(lf, fcntl.LOCK_EX)
        if call_busy():
            raise Fail("call in progress — screen not touched")
        if a.cmd == "presence":
            res.update(presence(ph)); res["ok"] = True
        elif a.cmd == "status":
            res.update(status(ph, a.channel)); res["ok"] = True
        else:
            if not a.image or not os.path.exists(a.image):
                raise Fail("missing --image")
            ch = a.channel
            if ch == "auto":
                p = presence(ph)
                res["presence"] = p
                ch = pick_channel(p)
            res["channel"] = ch
            if a.dry_run:
                res["ok"] = True
            else:
                uri, _ = push_image(a.image)
                {"viber": send_viber, "whatsapp": send_whatsapp, "mms": send_mms}[ch](ph, uri, a.text)
                res["ok"] = True
                res["sent_at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    except Fail as e:
        res["error"] = str(e)
        try:
            home()
        except Exception:
            pass
    except Exception as e:  # adb/timeout — report, never crash silently
        res["error"] = f"{type(e).__name__}: {e}"
    print(json.dumps(res, ensure_ascii=False))
    sys.exit(0 if res["ok"] else 1)


if __name__ == "__main__":
    main()
