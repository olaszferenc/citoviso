# 2026-09-16 — A honlapunk egy MEGSZŰNT vállalkozás adószámát adta ki

## Mi történt

A Barion a hiánypótlási szálban visszaírta, hogy **nem tudja megkezdeni** az elfogadóhely
vizsgálatát: *„mind a regisztráció során, mind a honlapja ÁSZF-ében egy megszűnt vállalkozás
azonosítószáma lett megadva"*.

Igaza volt. A `LEGAL_ENTITY_TAX_NUMBER` / `LEGAL_ENTITY_REG_NUMBER` egy **megszűnt** egyéni
vállalkozás adatait tartalmazta, és onnan került az élő ÁSZF-be és Impresszumba.

| | Régi (megszűnt) | Új (NAV: „Élő") |
|---|---|---|
| Adószám | 69646014-1-33 | **92227011-1-33** |
| Nyilvántartási szám | 53483083 | **62588818** |
| Székhely házszám | …utca 6. | …utca 6. **2.** (ajtó) |

Forrás: NAV Vállalkozói Ügysegéd / ÜPO — státusz **Élő**, nyilvántartásba vétel 2026.07.20.
(Két NAV-irat is megerősítette; az „Az egyéni vállalkozó adatai" lekérdezés a saját lábjegyzete
szerint **nem minősül hatósági bizonyítványnak**.)

## Javítás és igazolás

- `.env` (lokál + éles), 3 sor. ⚠️ A lokál `.env` **symlink a fő fába** → `sed -i` helyett
  `sed -i --follow-symlinks`, különben a worktree példánya levállik és a két fa szétcsúszik.
- Éles: külön engedéllyel, backup (`/opt/citoviso/backups/env-taxfix-20260915.bak`),
  console-kanári → public restart.
- **Visszaellenőrzés origin ÉS CDN felől**, cache-busterrel: a hat publikus jogi lapon a régi
  szám **0 előfordulás**, mind HTTP 200.
- DB-söprés: 65 tábla minden szöveges/jsonb oszlopa — **0 találat**, a szám csak az `.env`-ben élt.

## ⛔ Két tanulság, mindkettő a saját hibámból

**① A saját konfigunkból olvasni NEM mérés.** A `BARION-APPLICATION.md` fejléce azt állította,
hogy „minden adat MÉRVE (az éles `.env`-ből olvasva)" — és pont ezért volt hibás hat napig.
Az `.env` csak azt igazolja, amit MI hiszünk. **Cég-azonosítónál az egyetlen forrás a
nyilvántartás.**

**② Az ellenőrzőszám-kapunk ezt elvi okból nem foghatta meg.** Függetlenül újraszámolva
**mindkét adószám érvényes** ellenőrzőszámú (súlyok 9,7,3,1,9,7,3). A számtan a jó **ALAKOT**
bizonyítja, a **LÉTEZÉST** soha. A nyilvántartási STÁTUSZ NAV-lekérdezés, nem aritmetika.
Ez bekerült az `outreachCheck.ts` fejlécébe, hogy a kapu ne ígérjen többet, mint amit tud.

**③ Sor-alapú eszközzel mértem többsoros markupot — és HAMIS RIADÓT fújtam.**
Bejelentettem, hogy a Barion-logó nincs kint a főoldalon. **Kint volt.** A `grep` soronként
dolgozik, az `<img …>` tag viszont öt soron át van tördelve, ezért a `<img[^>]*barion` minta
**elvi okból sosem találhatott**; a „találatok" mind a követő-Pixel egysoros URL-jére estek.
A `grep -oc` ráadásul **sorokat** számol, nem előfordulást. Többsoros HTML-t csak
offset-alapú kereséssel (vagy parserrel) szabad mérni.

## Fájlok

- `.env` (lokál + éles, nem commitolt)
- `_planning/BARION-APPLICATION.md` — a három adat + a „miért volt hibás" blokk
- `scripts/outreach-gate-selftest.mts` — az éles fixture a valós számokra áll
- `src/outreach/outreachCheck.ts` — a kapu határa kimondva

## Nyitott

- **Tulaj-teendő:** a hatósági bizonyítvány (kérelem `UEVH-00277388`, beadva 2026.09.15,
  ügyintézési határidő 8 nap) az **Üzleti profil** menübe töltendő — a Barion kifejezetten
  kérte, hogy ne a Remark-szálba; ugyanott indítandó a videó-azonosítás.
- **Székhely-ékezet:** a NAV szerint az utcanév **„Kuno"**, ékezet nélkül; az élő lapokon
  jelenleg `Klebelsberg Kunó utca 6. 2.` áll. Javításhoz új éles engedély kell. Nem blokkoló.
  ⚠️ A NAV *székhely* mezőjében ráadásul elírás van (`KLEBESBERG`, „l" nélkül) — ezt **nem
  másoljuk le**, az impresszum igazat mond, nem elgépelést vesz át.
