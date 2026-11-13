# E-mail aláírás — jóváhagyott terv (ADR-XXXX)

**Tulaj döntése, 2026-11-13: „A) kell”** — a `terv-3-valtozat.html` A változata („Jel + cián vonal”).
A B és C változat csak a döntés dokumentációja.

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)
- Sorrend: „Üdvözlettel,” → kétcellás tábla: **bal** a kerek Citoviso-jel (56×56, CID-kép), **jobb** 2 px cián
  (`#1fb6d6`) bal szegéllyel: név (16 px, félkövér, `#0e2a47`), szerep (13 px, `#60748b`), címkézett sorok
  `W` web · `E` e-mail · `T` telefon (a címke cián, félkövér; üres mező sora kimarad).
- **Csapat-olvasat** (márka feladónév): „A Citoviso csapata” / „Honlap és online láthatóság”.
- **Névvel-olvasat** (személy feladónév): „<Név>” / „<OUTREACH_SENDER_TITLE> · Citoviso”. Név a kódban soha.
- Outlook-biztos: csak táblázat, nincs float/flex; mobilon (390 px) sem lóg ki.

## Fájlok
- `terv-3-valtozat.html` — a döntési mock (A/B/C, Csapat/Névvel, Mobil/Asztali kapcsoló).
- `{mobil,asztali}-{csapat,nevvel}.png` — a döntéskor mutatott képek.
- `megvalositva-{asztali,mobil}.png` — a kész kód öt levélben (megkeresés csapat/névvel, próba, ügyfélsegítő, mock-kész).
- `mailbox-signature-{csapat,nevvel}.html` — postafiókba (Zoho) beilleszthető aláírás; a jel a
  `https://citoviso.com/assets/brand/citoviso-jel-email.png` címről töltődik (a deploy után él).
