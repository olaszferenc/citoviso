# 2026-11-06 — SMS/MMS-költség, S10 hívásfogadás és SMS-híd

Session: `citc3087339` (brief `~/rc-briefs/sms-mms-20261106-130626.md`)

## Elvégzett munka
- **Árfelmérés:** a legolcsóbb SMS/MMS-szolgáltatók, magyarok és EU-sak (`MEMORY.md` Tények). ⛔ Az MMS-t SMS-re cserélni nem opció.
- **Októberi Telekom-számla:** 90 000 Ft. Volumen: 749 MMS és 785 SMS. Döntés: Viber/WhatsApp a modem számáról.
- **Android-emulátor (KVM):** nem működött. Túlterhelte a gépet, és a beviteli mező nem fogadta a gépelést. Helyette egy valódi telefon került be: Samsung Galaxy S10.
- **A modem SIM-je (+36 30 120 0971) átkerült a SIM800C-ből az S10-be.** Ok: a leadek visszahívják ezt a számot.
- **Hívó gép** (`scripts/callbot/`):
  - USB-s Bluetooth-adapter (ASUS BT400) + BlueALSA `hfp-hf`;
  - piper felolvasás, faster-whisper leirat, helyben, API nélkül.
  - Kipróbálva: a bejövő és a kimenő hívás is működik, a leirat szó szerint pontos.
  - A bemondó szöveget a tulaj jóváhagyta. Hívás utáni SMS nem kell.
  - Folyamatos hívásfogadás: a `citoviso-callbot` systemd-szolgáltatás.
- **S10-SMS-híd** (`s10_smsd.py`): a `gammu-smsd` egység drop-innal ezt futtatja.
  - A `minereal_sms` séma változatlan, így a Citoviso és a MineREAL SMS-e kód-módosítás nélkül megy.
  - Az S10-en az SMS Gateway for Android v1.77.5 fut, csak helyi szerverrel.
  - Mérve: egy 3 részes, ékezetes SMS 2 másodperc alatt `DeliveryOK` lett.
- **MineREAL-átadás:**
  - brief: `~mineral/rc-briefs/gsm-modem-sim-s10-20261106.md`;
  - session: `mrc3106614`;
  - frissítés tmux-üzenetben.

## Módosított / létrehozott fájlok
- **Repó:**
  - `MEMORY.md`;
  - `scripts/callbot/` mappa: `callbot.py`, `transcribe.py`, `s10_smsd.py`, `setup.sh`, `greeting.txt`, `citoviso-callbot.service`, `gammu-smsd-s10.conf`, `README.md`.
- **Gépen:**
  - `/etc/udev/rules.d/51-android-samsung.rules`;
  - `/etc/systemd/system/bluealsa.service.d/override.conf`;
  - `/etc/systemd/system/citoviso-callbot.service`;
  - `/etc/systemd/system/gammu-smsd.service.d/s10.conf`;
  - `/lib/firmware/brcm/BCM20702A1-0b05-17cb.hcd`.
- **Felhasználói fájlok:**
  - `~/speech-venv`, `~/speech/voices`;
  - titkok: `~/.config/citoviso/s10-smsgw.json`, `minereal-sms-db.env`;
  - `~/Android/s10ui.sh`.

## Nyitott kérdések / következő lépések
1. ✅ **MMS az S10-ről: megoldva** (11-07 01:55 óta, a `cit5980e14c` session, ADR-0430: Samsung Üzenetek + a11y-relay, `MMS_SENDER=s10`). A képernyőt a közös `~/.cache/s10-ui.lock` zár védi; a `~/Android/s10ui.sh` is ezt veszi fel.
2. A hívásfelvétel és a leirat a leadhez kötve kerüljön a Válaszok panelre. Most a `~/speech/calls/` mappában gyűlik.
3. A MineREAL saját SIM-et kap a 2-es SIM-helyre (tulaj, „lehet veszek”). Ezután a híd SIM-enként küld.
4. WhatsApp/Viber-regisztráció a modem számára. 11-06 23:39-kor jött egy WhatsApp-kód: ellenőrizni kell, ki indította.
