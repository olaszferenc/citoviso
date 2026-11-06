#!/usr/bin/env python3
"""S10 SMS bridge: a drop-in replacement for gammu-smsd that keeps the gammu SQL schema
(MySQL `minereal_sms`) as the interface, but sends and receives through the Galaxy S10.

Why: the modem SIM moved from the SIM800C to the S10 (2026-11-06) so that calls to the
modem number can be answered. Citoviso (src/sms/modemLane.ts) and MineREAL
(lib/sms_gateway.php) both talk to gammu only through this database, so nothing on
their side has to change:

  outbox / outbox_multipart  -> read, sent via "SMS Gateway for Android" (local REST API
                                on the phone, reached through `adb forward`), then moved to
  sentitems                  <- one row per original part (same ID, SequencePosition, UDH),
                                Status SendingOK -> DeliveryOK / SendingError
  inbox                      <- new rows from the phone's content://sms/inbox (adb shell)
  phones                     <- heartbeat (TimeOut = NOW()) while the phone answers /health

Runs as the gammu-smsd unit via a drop-in (see README), so `systemctl is-active gammu-smsd`
checks and the stop/start done by mms-send keep working.
"""
import base64, json, os, re, signal, subprocess, sys, time, urllib.request
from datetime import datetime

import pymysql

SERIAL = "RF8M2101WXX"
ADB = os.path.expanduser("~/Android/platform-tools/adb")
CFG_DIR = os.path.expanduser("~/.config/citoviso")
GW = json.load(open(os.path.join(CFG_DIR, "s10-smsgw.json")))
DB = dict(l.strip().split("=", 1) for l in open(os.path.join(CFG_DIR, "minereal-sms-db.env")) if "=" in l)
STATE_FILE = os.path.expanduser("~/.local/state/s10-smsd.json")
PHONE_ID = "minereal-gsm"          # the PhoneID gammu used; SenderID/RecipientID keep it
SIM_NUMBER = 1                     # SIM slot used for sending (1-based, gateway API)
FORWARD_PORT = 18080
SEND_TIMEOUT_S = 300               # not "Sent" by then -> SendingError
DELIVERY_TRACK_S = 3600            # keep polling for a delivery report this long
OK_SENT = ("Sent", "Delivered")

_stop = False


def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def adb(*args, timeout=20):
    return subprocess.run([ADB, "-s", SERIAL, *args], capture_output=True, text=True, timeout=timeout).stdout


def gw(method, path, body=None, timeout=15):
    req = urllib.request.Request(f"http://127.0.0.1:{FORWARD_PORT}{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Authorization", "Basic " + base64.b64encode(f"{GW['user']}:{GW['password']}".encode()).decode())
    if body is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode() or "{}")


def db():
    return pymysql.connect(host=DB["host"], user=DB["user"], password=DB["password"],
                           database=DB["database"], charset="utf8mb4", autocommit=False)


def load_state():
    try:
        return json.load(open(STATE_FILE))
    except Exception:
        return {"inflight": {}, "tracking": {}, "inbox_last_id": None}


def save_state(st):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    tmp = STATE_FILE + ".tmp"
    json.dump(st, open(tmp, "w"), ensure_ascii=False)
    os.replace(tmp, STATE_FILE)


# ---------------------------------------------------------------- heartbeat
def heartbeat(conn):
    try:
        h = gw("GET", "/health")
    except Exception as e:
        log(f"gateway unreachable: {e!r}")
        return False
    if h.get("status") != "pass":
        log(f"gateway health not pass: {h.get('status')}")
        return False
    battery = h.get("checks", {}).get("battery:level", {}).get("observedValue", -1)
    with conn.cursor() as c:
        c.execute("UPDATE phones SET TimeOut=NOW(), Send='yes', Receive='yes', Battery=%s, "
                  "Client=%s WHERE ID=%s", (battery, f"S10 bridge, SMS Gateway {h.get('version')}", PHONE_ID))
        if c.rowcount == 0:
            c.execute("INSERT INTO phones (ID, TimeOut, Send, Receive, IMEI, IMSI, Client, Battery) "
                      "VALUES (%s, NOW(), 'yes', 'yes', '', '', %s, %s)",
                      (PHONE_ID, f"S10 bridge, SMS Gateway {h.get('version')}", battery))
    conn.commit()
    return True


# ---------------------------------------------------------------- outbox -> phone
def pick_outbox(conn, st):
    with conn.cursor(pymysql.cursors.DictCursor) as c:
        c.execute("SELECT * FROM outbox WHERE SendingDateTime <= NOW() "
                  "AND CURTIME() BETWEEN SendAfter AND SendBefore ORDER BY Priority DESC, ID LIMIT 10")
        rows = c.fetchall()
        for r in rows:
            oid = str(r["ID"])
            if oid in st["inflight"]:
                continue
            c.execute("SELECT * FROM outbox_multipart WHERE ID=%s ORDER BY SequencePosition", (r["ID"],))
            parts = [dict(SequencePosition=1, UDH=r["UDH"] or "", Coding=r["Coding"], Class=r["Class"],
                          TextDecoded=r["TextDecoded"] or "")]
            parts += [dict(SequencePosition=m["SequencePosition"], UDH=m["UDH"] or "", Coding=m["Coding"],
                           Class=m["Class"], TextDecoded=m["TextDecoded"] or "") for m in c.fetchall()]
            if r["MultiPart"] == "true" and len(parts) == 1:
                continue  # multipart rows not written yet by the injector; next round
            text = "".join(p["TextDecoded"] for p in parts)
            dest = r["DestinationNumber"]
            try:
                res = gw("POST", "/message", {"textMessage": {"text": text}, "phoneNumbers": [dest],
                                              "simNumber": SIM_NUMBER, "withDeliveryReport": True})
            except Exception as e:
                log(f"outbox {oid}: gateway POST failed {e!r}; retry later")
                return
            st["inflight"][oid] = {"gw": res["id"], "dest": dest, "parts": parts, "since": time.time(),
                                   "creator": r["CreatorID"], "validity": r["RelativeValidity"]}
            save_state(st)
            log(f"outbox {oid} -> {dest} ({len(parts)} part, {len(text)} chars) gw={res['id']}")


def finish(conn, oid, info, status, state):
    """Move an outbox message to sentitems (one row per original part), like gammu does."""
    with conn.cursor() as c:
        for p in info["parts"]:
            c.execute("INSERT INTO sentitems (InsertIntoDB, SendingDateTime, DeliveryDateTime, Text, "
                      "DestinationNumber, Coding, UDH, SMSCNumber, Class, TextDecoded, ID, SenderID, "
                      "SequencePosition, Status, StatusError, TPMR, RelativeValidity, CreatorID, StatusCode) "
                      "VALUES (NOW(), NOW(), %s, '', %s, %s, %s, '', %s, %s, %s, %s, %s, %s, -1, -1, %s, %s, -1)",
                      (datetime.now() if status == "DeliveryOK" else None, info["dest"], p["Coding"], p["UDH"],
                       p["Class"] if p["Class"] is not None else -1, p["TextDecoded"], int(oid), PHONE_ID,
                       p["SequencePosition"], status, info["validity"] if info["validity"] is not None else -1,
                       info["creator"] or ""))
        c.execute("DELETE FROM outbox_multipart WHERE ID=%s", (int(oid),))
        c.execute("DELETE FROM outbox WHERE ID=%s", (int(oid),))
    conn.commit()
    log(f"outbox {oid} -> sentitems {status} (gw {state})")


def poll_inflight(conn, st):
    for oid, info in list(st["inflight"].items()):
        try:
            m = gw("GET", f"/message/{info['gw']}")
        except Exception as e:
            log(f"outbox {oid}: status read failed {e!r}")
            continue
        state = m.get("state")
        if state in OK_SENT:
            finish(conn, oid, info, "DeliveryOK" if state == "Delivered" else "SendingOK", state)
            if state != "Delivered":
                st["tracking"][oid] = {"gw": info["gw"], "since": time.time()}
            del st["inflight"][oid]
        elif state == "Failed" or time.time() - info["since"] > SEND_TIMEOUT_S:
            finish(conn, oid, info, "SendingError", state)
            del st["inflight"][oid]
        save_state(st)


def poll_delivery(conn, st):
    for oid, t in list(st["tracking"].items()):
        if time.time() - t["since"] > DELIVERY_TRACK_S:
            del st["tracking"][oid]
            continue
        try:
            state = gw("GET", f"/message/{t['gw']}").get("state")
        except Exception:
            continue
        if state in ("Delivered", "Failed"):
            with conn.cursor() as c:
                c.execute("UPDATE sentitems SET Status=%s, DeliveryDateTime=NOW() WHERE ID=%s",
                          ("DeliveryOK" if state == "Delivered" else "DeliveryFailed", int(oid)))
            conn.commit()
            log(f"sentitems {oid} -> {state}")
            del st["tracking"][oid]
    save_state(st)


# ---------------------------------------------------------------- phone -> inbox
ROW_RE = re.compile(r"^Row: \d+ _id=(\d+), address=(.*?), date=(\d+), body=", re.S)
GSM7 = set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZ"
           "ÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")


def read_phone_inbox(after_id):
    # adb shell joins its args into one remote command line: quote the operators/spaces
    out = adb("shell", f"content query --uri content://sms/inbox --projection _id:address:date:body "
                       f"--where '_id>{int(after_id)}' --sort '_id ASC'")
    rows, cur = [], None
    for line in out.split("\n"):
        m = ROW_RE.match(line)
        if m:
            cur = {"id": int(m.group(1)), "address": m.group(2), "date": int(m.group(3)), "body": line[m.end():]}
            rows.append(cur)
        elif cur is not None:
            cur["body"] += "\n" + line  # multi-line body continues until the next "Row:"
    for r in rows:
        r["body"] = r["body"].rstrip("\r\n")
    return rows


def max_phone_inbox_id():
    out = adb("shell", "content query --uri content://sms/inbox --projection _id --sort '_id DESC'")
    m = re.search(r"_id=(\d+)", out)
    return int(m.group(1)) if m else 0


def poll_inbox(conn, st):
    if st.get("inbox_last_id") is None:
        st["inbox_last_id"] = max_phone_inbox_id()  # start from now; earlier test SMS are not leads
        save_state(st)
        log(f"inbox starts after phone _id {st['inbox_last_id']}")
        return
    for r in read_phone_inbox(st["inbox_last_id"]):
        coding = "Default_No_Compression" if set(r["body"]) <= GSM7 else "Unicode_No_Compression"
        with conn.cursor() as c:
            c.execute("INSERT INTO inbox (ReceivingDateTime, Text, SenderNumber, Coding, UDH, SMSCNumber, "
                      "Class, TextDecoded, RecipientID, Processed) "
                      "VALUES (FROM_UNIXTIME(%s), '', %s, %s, '', '', -1, %s, %s, 'false')",
                      (r["date"] / 1000.0, r["address"], coding, r["body"], PHONE_ID))
            c.execute("UPDATE phones SET Received=Received+1 WHERE ID=%s", (PHONE_ID,))
        conn.commit()
        st["inbox_last_id"] = r["id"]
        save_state(st)
        log(f"inbox <- {r['address']} ({len(r['body'])} chars)")


# ---------------------------------------------------------------- main loop
def main():
    def stop(*_):
        global _stop
        _stop = True
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    st = load_state()
    conn = None
    last_fwd = last_hb = last_inbox = 0.0
    alive = False
    log("s10-smsd started")
    while not _stop:
        try:
            if conn is None:
                conn = db()
            now = time.time()
            if now - last_fwd > 30:
                adb("forward", f"tcp:{FORWARD_PORT}", "tcp:8080")
                last_fwd = now
            if now - last_hb > 20:
                alive = heartbeat(conn)
                last_hb = now
            if alive:
                poll_inflight(conn, st)
                pick_outbox(conn, st)
                poll_delivery(conn, st)
            if now - last_inbox > 5:
                poll_inbox(conn, st)
                last_inbox = now
        except pymysql.err.Error as e:
            log(f"db error: {e!r}")
            try:
                conn.close()
            except Exception:
                pass
            conn = None
        except Exception as e:
            log(f"error: {e!r}")
        time.sleep(2)
    log("s10-smsd stopped")


if __name__ == "__main__":
    main()
