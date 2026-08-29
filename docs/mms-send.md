# MMS-küldés a helyi GSM-modemen át — `mms-send` eszköz

**Státusz: ÉLES, végponttól végpontig bizonyított** (2026-08-29: kézbesített teszt-MMS-ek,
MMSC message-ID-vel). Tulaj-döntés: a modem ezen a Debian gépen marad, benne a Telekom
**fő SIM** (`+36 30 120 0971`) — a címzett ezt a számot látja feladóként.

## Mire való (Citoviso use case)

Leadeknek, akiknél **nincs e-mail, csak mobilszám**: az elkészült honlap-mockupról
képet küldeni MMS-ben. Az SMS-sel ellentétben itt maga a kép megy, nem link.

## Használat

```bash
sudo mms-send --to 06301234567 --image /path/screenshot.jpg --subject "Citoviso"
```

- `--to` — magyar mobilszám `06...`, `36...` vagy `+36...` formában (normalizálja)
- `--image` — **CSAK JPEG** (magic-byte ellenőrzés van; PNG-t konvertálni kell előbb)
- `--subject` — opcionális, **ASCII** (ékezet lecserélődik), max ~40 karakter

Kimenet: egy JSON-sor stdout-ra, exit 0/1:

```json
{"ok": true, "to": "+36301234567", "message_id": "D41D...", "response_text": "1000:OK"}
{"ok": false, "error": "MMSC elutasitas: status=0xE1 2504:Your balance is too low"}
```

Az `ok:true` + `message_id` = az MMSC **befogadta és számlázta**; a kézbesítés a
címzett hálózatán múlik (mobiladat kell a letöltéséhez a címzett telefonján).

## Korlátok — TERVEZZ EZEKKEL

| Korlát | Érték | Miért |
|---|---|---|
| Képméret | **≤ 300 KB** JPEG | MMSC-plafon; az eszköz elutasítja felette |
| Futásidő | **~60–90 mp / MMS** | 2G GPRS feltöltés — ez NEM tömeges csatorna |
| Kizárólagosság | küldés alatt a modem foglalt | `flock` védi; párhuzamos hívás `masik mms-send fut` hibával kilép |
| SMS-kiesés | a küldés idejére a `gammu-smsd` áll | a sorban álló SMS-ek a DB-ben várnak, utána automatikusan mennek |
| Jogosultság | **root** (`sudo`) kell | systemctl stop/start + soros port |
| Subject | ASCII | WSP text-string; ékezetes tárgyat kerülni |

## Képkonverzió (PNG screenshot → MMS-kész JPEG)

```bash
python3 - <<'EOF'
from PIL import Image
img = Image.open('shot.png').convert('RGB')
img.thumbnail((1280, 1280))                # bőven elég MMS-hez
q = 85
while True:
    img.save('shot.jpg', 'JPEG', quality=q)
    import os
    if os.path.getsize('shot.jpg') <= 290_000 or q <= 40: break
    q -= 10
EOF
```

## Hibák és jelentésük

- **`2504:Your balance is too low`** — a modemben NEM a fő SIM van (a MultiSIM technikai
  számoknak nincs MMS-számlázási leképezése). A fő SIM-nek kell a modemben lennie.
- **`bearer up de nincs IP` / SAPBR hiba** — GPRS-glitch, próbáld újra 1-2 perc múlva.
- **Soros port I/O error / `-110`** — a modult USB3 (xHCI) portba dugták; **CSAK a
  USB2 (ehci-pci) port jó** (`lsusb -t`-ben `Driver=ch341` az `ehci-pci` fa alatt legyen).
- **`masik mms-send fut eppen`** — várd meg az előzőt (lock: `/var/lock/mms-send.lock`).

## Integrációs minta (queue-alapú, az sms-relay analógiájára)

Az `scripts/sms-relay.mts` mintájára építhető `mms-relay`: távoli sor → pull →
`sudo mms-send` hívás soronként → ack a message_id-vel. A ~90 mp/darab miatt
**percenkénti timer + soronként EGY üzenet** a jó ütem, nem batch.

⚠️ **Jogi őrszem (ld. CLAUDE.md §7):** a lead-MMS ugyanúgy közvetlen üzletszerzés,
mint a hideg e-mail — célzott, személyre szabott, és legyen benne lemondási út
(pl. "STOP" válasz-SMS figyelése a gammu inboxban: `minereal_sms.inbox` tábla).

## Műszaki háttér (ha mélyebbre kell ásni)

Az eszköz forrása: `/usr/local/bin/mms-send` (Python3, pyserial). Pipeline:
`wap` APN (⚠️ nem internet.telekom!) → Telekom WAP-proxy `212.51.126.10:8080` →
kézzel épített WSP M-Send.req POST a `http://mms.t-mobile.hu/servlets/mms` MMSC-re →
M-Send.conf válasz parse-olása (Response-Status 0x80=Ok + Message-ID).
⚠️ A SIM800 beépített `AT+CMMS*` motorja HASZNÁLHATATLAN diagnosztikára: minden
MMSC-hibára sima `OK`-t ad. MMS-fogadás is lehetséges (WAP-push a gammu inboxba +
proxy-n át HTTP GET) — recept a mineral-oldali memóriában
(`project_mms_sim800c_multisim_blocked_2026_08_29.md`).
