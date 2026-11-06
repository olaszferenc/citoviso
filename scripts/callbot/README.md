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
  valamint az SMS és az MMS átköltöztetése az S10-re.

## Ismert apróságok

- Az `arecord` megszakításakor a `caller.wav` fejlécében a hossz hibás marad (a sox és az ffmpeg
  ettől még helyesen olvassa). A `conversation.wav` hossza helyes.
- A telefon képernyője töltés közben nem zárhat le (`stay_on_while_plugged_in 7`), különben
  a párosításnál nem kattintható a párbeszédablak.
