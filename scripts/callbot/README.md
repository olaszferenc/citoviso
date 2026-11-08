# Hívás-bot — a modem számának hívásfogadása és visszahívása

A leadek visszahívják a modem számát (+36 30 120 0971). A SIM800C ezt nem tudta
felvenni. 2026-11-06 óta a SIM egy Samsung Galaxy S10-ben van, és ez a gép kezeli
a hívást: felveszi, felolvassa a bemondást, sípol, rögzít, majd helyben leiratot készít.
Kimenő hívásnál ugyanez történik: tárcsáz, a felvétel után beszél, majd rögzít.

## Felépítés

| rész | eszköz |
|---|---|
| telefon (SIM, hálózat) | Galaxy S10, SM-G973F, Android 12, adb USB-n (sorozatszám `RF8M2101WXX`) |
| hívásvezérlés | adb: `dumpsys telephony.registry` (állapot, hívószám), `KEYCODE_CALL` / `KEYCODE_ENDCALL`, `am start -a android.intent.action.CALL` |
| hívás hangja | Bluetooth kihangosító: ASUS USB-BT400 (BCM20702) + BlueZ + BlueALSA `hfp-hf`, mSBC 16 kHz, ALSA-eszköz `bluealsa:DEV=<MAC>,PROFILE=sco` |
| felolvasás | piper, `hu_HU-anna-medium` hang |
| leirat | faster-whisper `large-v3-turbo`, int8, CPU (egy rövid hívás kb. 75 mp) |

Minden helyben fut, API-hívás nincs.

## Használat

```bash
bash scripts/callbot/setup.sh                       # egyszer, a gép beállítása (idempotens)
sg audio -c "python3 scripts/callbot/callbot.py answer --text '<bemondás>'"
sg audio -c "python3 scripts/callbot/callbot.py dial +3630... --text '<szöveg>'"

# folyamatos hívásfogadás a jóváhagyott greeting.txt-vel (a fő fából fut):
sudo cp scripts/callbot/citoviso-callbot.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now citoviso-callbot
journalctl -u citoviso-callbot -f
```

⚠️ A `greeting.txt` a tulaj által jóváhagyott szöveg; csak az ő jóváhagyásával változhat.
A szolgáltatás a fő fából fut (`/home/citoviso/citoviso`), tehát egy landolt változás az
újraindítás után azonnal élesben hat.

Hívásonként a `~/speech/calls/<időbélyeg>-<in|out>-<szám>/` mappa keletkezik:
`greeting.wav` (amit mondtunk), `caller.wav` (a másik fél), `conversation.wav` (a kettő keverve),
`transcript.txt`, `meta.json`.

## Állapot (2026-11-06)

- Mindkét irányt kipróbáltuk a tulaj tesztmobiljával, mindkét leirat szó szerint pontos lett.
- A bemondást a tulaj **jóváhagyta** (2026-11-06), a szövege a `MEMORY.md`-ben van. Más szöveg
  csak az ő jóváhagyásával mehet élesbe.
- Hívás utáni SMS-visszaigazolás **nem kell** (tulaj, 2026-11-06).
- Folyamatos figyelés: `citoviso-callbot` systemd-szolgáltatás (2026-11-06 óta fut).
- Még nincs kész: a lead hozzárendelése és a Válaszok panel,
  (az SMS és az MMS 2026-11-07 óta az S10-ről megy).

## SMS: S10-híd a gammu helyén (`s10_smsd.py`)

A Citoviso (`src/sms/modemLane.ts`) és a MineREAL (`lib/sms_gateway.php`) is csak a gammu
SQL-adatbázisán (`minereal_sms`) át küld, a `gammu-smsd-inject`-tel. Ezért a híd ugyanezt a sémát
használja, és egyik projekt kódjához sem kell hozzányúlni:

- `outbox` és `outbox_multipart` → egy üzenet a telefonon futó **SMS Gateway for Android**
  appnak (v1.77.5, `me.capcom.smsgateway`, csak helyi szerver, felhő kikapcsolva; REST API
  `adb forward tcp:18080 tcp:8080`-on át). Az app maga darabolja az üzenetet és kér kézbesítési jelentést.
- `sentitems` ← részenként egy sor, ugyanazzal az ID-vel, SequencePosition-nel és UDH-val,
  `SendingOK` → `DeliveryOK` / `DeliveryFailed`, hibánál `SendingError` (5 perc után is).
- `inbox` ← a telefon `content://sms/inbox`-ából (adb shell, READ_SMS), egy sor üzenetenként.
- `phones` ← szívverés (`TimeOut = NOW()`) 20 mp-enként, amíg az app `/health` válasza `pass`.

Futtatás: a `gammu-smsd` systemd-egység drop-innal ezt indítja (`gammu-smsd-s10.conf` →
`/etc/systemd/system/gammu-smsd.service.d/s10.conf`). Így a `systemctl is-active gammu-smsd`
ellenőrzések és az `mms-send` leállítás/indítás változatlanul működnek. Visszaállás a SIM800C-re:
a drop-in törlése + `daemon-reload` + a SIM vissza a modembe.
Titkok: `~/.config/citoviso/s10-smsgw.json` és `~/.config/citoviso/minereal-sms-db.env` (600).
Állapot: `~/.local/state/s10-smsd.json`. Mérve 2026-11-06 23:53: egy 3 részes ékezetes SMS
injektálástól a kézbesítésig 2 mp alatt ment át.

MMS: 2026-11-07 óta az S10-ről megy (ADR-0430, `src/mms/s10Sender.ts` → Samsung Üzenetek,
a11y-relay). Képernyő-vezérlés előtt mindenki a közös `~/.cache/s10-ui.lock` zárat veszi fel (`flock`).

## Ismert apróságok

- Az `arecord` megszakításakor a `caller.wav` fejlécében a hossz hibás marad (a sox és az ffmpeg
  ettől még helyesen olvassa). A `conversation.wav` hossza helyes.
- A telefon képernyője töltés közben nem zárhat le (`stay_on_while_plugged_in 7`), különben
  a párosításnál nem kattintható a párbeszédablak.
