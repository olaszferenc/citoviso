#!/usr/bin/env python3
"""S10 messenger-first sender (ADR-0430): Viber -> WhatsApp -> MMS, one image + one text.

  s10_send.py presence --to 36301234567
  s10_send.py send --to 36301234567 --image kep.jpg --text "..." [--mms-text "..."] [--channel auto|viber|whatsapp|mms] [--dry-run]
  s10_send.py send --to 36301234567 --channel viber|whatsapp --text "..."   (no image: a text into the chat)
  s10_send.py status --to 36301234567 --channel whatsapp|viber

Prints ONE JSON line. Exit 0 = the message is visible as sent in the chosen app; exit 1 = not sent.
UI rules: WhatsApp drops injected input -> clicks/text go through the accessibility bridge
(com.citoviso.a11y, scripts/s10-a11y). The screen is exclusive: flock ~/.cache/s10-ui.lock, and
nothing is touched while a call is ringing or active (citoviso-callbot owns calls).
"""
import argparse, fcntl, hashlib, html, json, os, re, subprocess, sys, time
from datetime import date

SER = os.environ.get("ADB_SERIAL", "RF8M2101WXX")
ADB = [os.path.expanduser("~/Android/platform-tools/adb"), "-s", SER]
LOCK = os.path.expanduser("~/.cache/s10-ui.lock")
VIBER_FRESH_DAYS = 30
# The open Viber chat's call button: 'menu_viber_call' until the 2026-11-09 overnight Viber update,
# 'menu_mixed_call' since (measured: every presence read turned "unknown" and a send would have failed).
VIBER_CHAT_IDS = ("com.viber.voip:id/menu_viber_call", "com.viber.voip:id/menu_mixed_call")


def viber_chat_open(x):
    return any(i in x for i in VIBER_CHAT_IDS)
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
    x, r = wait_for(lambda x: "no" if "nem elérhető" in x else ("yes" if viber_chat_open(x) else None))
    name = seen = ""
    if r == "yes":
        time.sleep(2)
        y = dump()
        name, seen = text_of(y, "com.viber.voip:id/title"), text_of(y, "com.viber.voip:id/subtitle")
    elif r == "no":
        a11y("click", "android:id/button2")
    home()
    return r or "unknown", name, seen


def presence(ph, no_whatsapp=False, only_whatsapp=False):
    # Viber FIRST; WhatsApp only when there is no fresh Viber (owner 2026-11-09: „whatsappot csak ott
    # keressünk … ahol nem találtunk vibert” — the bulk WhatsApp lookups got the account banned).
    # no_whatsapp: WhatsApp paused, never open it. only_whatsapp: the Viber read is already known.
    if only_whatsapp:
        return {"whatsapp": presence_whatsapp(ph), "viber": "skipped", "viber_name": "", "viber_last_seen": "",
                "viber_age_days": None}
    vb, name, seen = presence_viber(ph)
    age = viber_age_days(seen)
    fresh = vb == "yes" and age is not None and age <= VIBER_FRESH_DAYS
    if no_whatsapp or fresh:
        wa = "skipped"
    else:
        time.sleep(3)
        wa = presence_whatsapp(ph)
    return {"whatsapp": wa, "viber": vb, "viber_name": name, "viber_last_seen": seen, "viber_age_days": age}


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


def viber_dismiss_overlays(x):
    """2026-11-10 (fresh install): popups cover the chat and hide it from the dump, so a sent message
    looked "not visible" and the retry could send twice. Close them; True = something was closed."""
    if "com.viber.voip:id/design_bottom_sheet" in x and "com.viber.voip:id/positive_button" in x:
        a11y("click", "com.viber.voip:id/positive_button")
        return True
    if "com.viber.voip:id/allow_btn" in x:
        a11y("click", "com.viber.voip:id/allow_btn")
        return True
    if "A kérés nem elérhető" in x and 'text="Mégse"' in x:
        a11y("click", "~Mégse")
        return True
    if 'text="Rendben"' in x and ("MI-funkci" in x or "új külsőt" in x):
        a11y("click", "~Rendben")
        return True
    return False


def send_viber(ph, uri, text):
    sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"'viber://chat?number=%2B{ph}'")
    def chat_ready(x):
        # Viber promo sheets ("Adjon új külsőt a képeknek" — Rendben) cover the chat after an update.
        if "com.viber.voip:id/design_bottom_sheet" in x and "com.viber.voip:id/positive_button" in x:
            a11y("click", "com.viber.voip:id/positive_button")
            return None
        # 2026-11-10: the privacy-consent screen swallows the chat intent; accept it and open the chat again.
        if "com.viber.voip:id/allow_btn" in x:
            a11y("click", "com.viber.voip:id/allow_btn")
            time.sleep(2)
            sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"'viber://chat?number=%2B{ph}'")
            return None
        return "com.viber.voip:id/options_menu_open_gallery" in x or None
    x, ok = wait_for(chat_ready)
    if not ok:
        raise Fail("viber: chat did not open")
    # A retry after "sent message not visible" must not send twice: if the caption is already in
    # the chat, the earlier attempt went out.
    time.sleep(1.5)
    x = dump()
    for _ in range(3):
        if not viber_dismiss_overlays(x):
            break
        time.sleep(1.5)
        x = dump()
    if text[:25] in x:
        home()
        return
    # 2026-11-10: two leads' messages landed in a THIRD lead's chat — the intent did not switch the
    # chat (a consent screen swallowed it) and the previously open chat looked "ready". Every outreach
    # chat holds our caption "<Name> – … A Citoviso csapata"; one with ANOTHER name is the wrong chat.
    ours = text.split(" – ")[0]
    foreign = [t for t in re.findall(r'text="([^"]*Citoviso csapata[^"]*)"', x) if html.unescape(t).split(" – ")[0] != ours]
    if foreign:
        home()
        raise Fail("viber: wrong chat open (another lead's message is there) — not sent")
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
    x, ok = wait_for(lambda x: None if viber_dismiss_overlays(x) else (snippet in x and viber_chat_open(x)), tries=12)
    if not ok:
        raise Fail("viber: sent message not visible in chat")
    home()


def send_text(ph, channel, text):
    """A plain text into an existing chat (ADR-0430: the operator's answer to a messenger reply)."""
    if channel == "whatsapp":
        sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"https://wa.me/{ph}", "-p", "com.whatsapp")
        x, ok = wait_for(lambda x: "com.whatsapp:id/entry" in x or RESTRICTED_RX.search(x))
        if not ok or RESTRICTED_RX.search(x):
            raise Fail("whatsapp: chat did not open")
        if not a11y("settext", "com.whatsapp:id/entry", text):
            raise Fail("whatsapp: text could not be set")
        time.sleep(1)
        if not a11y("click", "com.whatsapp:id/send"):
            raise Fail("whatsapp: send click failed")
    else:
        sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"'viber://chat?number=%2B{ph}'")
        x, ok = wait_for(lambda x: "com.viber.voip:id/send_text" in x or RESTRICTED_RX.search(x))
        if not ok or RESTRICTED_RX.search(x):
            raise Fail("viber: chat did not open")
        if not a11y("settext", "com.viber.voip:id/send_text", text):
            raise Fail("viber: text could not be set")
        time.sleep(1)
        if not a11y("click", "com.viber.voip:id/btn_send"):
            raise Fail("viber: send click failed")
    snippet = text[:25]
    x, ok = wait_for(lambda x: snippet in x, tries=8)
    if not ok:
        raise Fail(f"{channel}: sent text not visible in chat")
    home()


def send_mms(ph, uri, text):
    sh("am", "start", "-a", "android.intent.action.SEND", "-t", "image/jpeg",
       "--eu", "android.intent.extra.STREAM", uri, "--es", "address", "06" + ph[2:],  # ph = 36…: domestic form is 06…, not 0… (2026-11-10: every S10 MMS went to an invalid number)
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


# A banned/limited account shows one of these instead of the chat (WhatsApp, Viber; HU + EN).
RESTRICTED_RX = re.compile(r"nem használhatja a WhatsAppot|fiókod(at)? (le|ki)tiltott|korlátozt|"
                           r"is banned|account (is )?(banned|restricted)|deaktivál", re.I)


def nodes(x):
    """(resource-id tail, text, content-desc, x1, y1, x2, y2) for every node of a dump."""
    out = []
    for m in re.finditer(r"<node [^>]*>", x):
        n = m.group(0)
        g = lambda k: (re.search(k + r'="([^"]*)"', n) or [None, ""])[1]
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        if b:
            out.append((g("resource-id").split("/")[-1], g(" text"), g("content-desc"), *map(int, b.groups())))
    return out


def screencap_png():
    return subprocess.run(ADB + ["exec-out", "screencap", "-p"], capture_output=True, timeout=30).stdout


def viber_tick_state(png, box):
    """Viber draws the receipt as an icon with no accessibility text. Measured 2026-11-07 on the
    S10: a seen message has a CYAN double tick (~(102,238,255)); delivered is a white/grey double
    tick; sent is a single tick. Returns 'read' | 'delivered' | 'sent'."""
    import io
    from PIL import Image
    im = Image.open(io.BytesIO(png)).convert("RGB").crop(box)
    cyan = white = 0
    for r, g, b in im.getdata():
        if b > 230 and g > 200 and r < 150:
            cyan += 1
        elif r > 200 and g > 200 and b > 200:
            white += 1
    return "read" if cyan >= 40 else ("delivered" if white >= 80 else "sent")


INCOMING_MAX_X1 = 160  # incoming bubbles start at the left edge; ours start right of it


def status(ph, channel):
    """Read the chat without typing anything: receipt of our last message, the peer's last-seen line,
    and the texts of incoming bubbles visible on screen."""
    if channel == "whatsapp":
        sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"https://wa.me/{ph}", "-p", "com.whatsapp")
        x, _ = wait_for(lambda x: "com.whatsapp:id/conversation_contact_name" in x or RESTRICTED_RX.search(x))
        if RESTRICTED_RX.search(x):
            home()
            return {"restricted": True}
        ns = nodes(x)
        sts = [d for (rid, t, d, *_b) in ns if rid == "status" and d]
        last = sts[-1] if sts else ""
        receipt = ("read" if re.search(r"Megnézve|Olvasott|Read", last) else
                   "delivered" if re.search(r"Kézbesítve|Delivered", last) else "sent" if last else "")
        incoming = [t for (rid, t, d, x1, y1, x2, y2) in ns
                    if rid in ("message_text", "caption") and t and x1 < INCOMING_MAX_X1]
        seen = text_of(x, "com.whatsapp:id/conversation_contact_status")
        home()
        return {"receipt": receipt, "receipt_raw": last, "last_seen": seen, "incoming": incoming}
    sh("am", "start", "-a", "android.intent.action.VIEW", "-d", f"'viber://chat?number=%2B{ph}'")
    x, _ = wait_for(lambda x: viber_chat_open(x) or RESTRICTED_RX.search(x))
    if RESTRICTED_RX.search(x):
        home()
        return {"restricted": True}
    ns = nodes(x)
    ticks = [(x1, y1, x2, y2) for (rid, t, d, x1, y1, x2, y2) in ns if rid == "statusView"]
    receipt = viber_tick_state(screencap_png(), ticks[-1]) if ticks else ""
    incoming = [t for (rid, t, d, x1, y1, x2, y2) in ns
                if rid == "textMessageView" and t and x1 < INCOMING_MAX_X1]
    seen = text_of(x, "com.viber.voip:id/subtitle")
    home()
    return {"receipt": receipt, "last_seen": seen, "incoming": incoming}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["presence", "send", "status"])
    ap.add_argument("--to", required=True)
    ap.add_argument("--image")
    ap.add_argument("--text", default="")
    ap.add_argument("--mms-text", default=None, help="text of the MMS when auto falls back to MMS (default: --text)")
    ap.add_argument("--channel", default="auto")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-whatsapp", action="store_true", help="WhatsApp paused: never open it (presence, auto ladder)")
    ap.add_argument("--only-whatsapp", action="store_true", help="presence: read WhatsApp only (the Viber read is known: no Viber)")
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
        # A (swipe) keyguard hides every app behind it and every read comes back "unknown"
        # (measured 2026-11-08 evening). Dismiss it; refuse if a secure lock stays up.
        if "isKeyguardShowing=true" in sh("dumpsys", "window"):
            sh("wm", "dismiss-keyguard")
            time.sleep(1.5)
            if "isKeyguardShowing=true" in sh("dumpsys", "window"):
                raise Fail("screen locked — keyguard could not be dismissed")
        if a.cmd == "presence":
            res.update(presence(ph, a.no_whatsapp, a.only_whatsapp)); res["ok"] = True
        elif a.cmd == "status":
            res.update(status(ph, a.channel)); res["ok"] = True
        else:
            if not a.image and a.channel in ("viber", "whatsapp"):
                if not a.text.strip():
                    raise Fail("missing --text")
                res["channel"] = a.channel
                if not a.dry_run:
                    send_text(ph, a.channel, a.text)
                    res["sent_at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
                res["ok"] = True
                print(json.dumps(res, ensure_ascii=False))
                sys.exit(0)
            if not a.image or not os.path.exists(a.image):
                raise Fail("missing --image")
            ch = a.channel
            if ch == "auto":
                p = presence(ph, a.no_whatsapp)
                res["presence"] = p
                ch = pick_channel(p)
            res["channel"] = ch
            if a.dry_run:
                res["ok"] = True
            else:
                uri, _ = push_image(a.image)
                text = a.mms_text if (ch == "mms" and a.mms_text is not None) else a.text
                {"viber": send_viber, "whatsapp": send_whatsapp, "mms": send_mms}[ch](ph, uri, text)
                res["ok"] = True
                res["sent_at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    except Fail as e:
        res["error"] = str(e)
        try:
            if RESTRICTED_RX.search(dump()):
                res["restricted"] = True
        except Exception:
            pass
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
