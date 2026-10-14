# Elek éles teszt — IT-tesztelő kör (2026-10-14)

Éles verzió `0038426a` (prod/20261014-1403). Lencse: tapasztalt IT-tesztelő (biztonság, adat-helyesség, hibakezelés, határesetek, teljesítmény). Saját `[TESZT] IT Norah Apartman` leaden/tenanton, rombolás nélkül; fizetést nem indítottam. Munkafa `~/wt/cit0c04ea6a`, részletes jelentés (gitignore-olt) `_elek/JELENTES.md`, képek `_elek/shots/`.

## Eredmény
- **Korábbi fő leletek mind javultak:** V-1 (mobil szelvény ellátás-összege, 90 500), O-2 (operátor látja a próbát+foglalást — ADR-0386), L-1 (pirula a kártyacímen — ADR-0387).
- **3 új lelet** (a koordinátornak továbbítva, döntésre):
  - **S-1 KÖZEPES (biztonság):** nincs CSRF-védelem az állapotváltó POST-okon (se token, se Origin/Referer-ellenőrzés, csak `SameSite=Lax`, `auth/loginGuard.ts:25`). Élőben igazolva: idegen Origin-fejléces POST a `/admin/prices/base`-re átírta az árat. A Lax egy IDEGEN oldalról véd, de a `*.citoviso.com` aldomainek azonos-site-ok → aldomaines, formot beküldő tartalom megkerüli. Jelenleg nincs könnyű befészkelő-pont (szöveg escape-elt, feltöltés sharppal újrakódolt), de hiányzó kontroll. Javaslat: Origin/Referer-allowlist a POST-okra.
  - **P-1 KÖZEPES (teljesítmény):** `listLeadPage` (`src/console/data.ts:258`) LIMIT nélkül tölti be mind a ~9000 leadet (teljes `raw` JSONB) + az összes mockot minden `/leads` ÉS Irányítópult-betöltéskor → 4,2 MB HTML / 1,75 s TTFB; a lead-számmal lineárisan romlik. Javaslat: DB-limit + lapozás; a `raw` ne töltődjön a listához.
  - **R-1 APRÓ (robusztusság):** `/admin/prices/base` POST `unit` nélkül → nyers HTTP 500 (`string_to_uuid`), nem validációs üzenet.

## Biztonsági PASS
- IDOR nincs: 23 tenant-admin/foglalási végpont tenant-re/site-ra szűr (subagent, file:line); idegen `unit` uuid a `/api/foglalas`-on → „Ismeretlen egység.” (élő).
- XSS nincs: `<img onerror>`/`<script>`/`<svg onload>` a vendég nevében+üzenetében minden felületen escape-elve (admin, konzol, tulaj-levél — `esc()`, `mailQuote`, `platformLayout.ts:103`).
- Fotó-feltöltés nem XSS-vektor: `normalizeUpload` (`src/tenant/photoUpload.ts`) jpg/webp-re kódol át; SVG nem tárolható futtathatóan.
- Tokenek: jelszó-beállító link egyszer használható (reuse→410), hamis token 404/410, GET soha nem dönt; accept/cancel token 192 bit.
- Rate-limit `/api/foglalas` 5/10perc/IP — élőben blokkolta a határeset-sorozatot.
- Határesetek kód-igazolt (`createBookingRequest`/`stayRuleErrors`): past-date (szállás-időzóna, ADR-0290), nights<1, min/max éj, szezon-zárás, horizont, létszám 1..50 clamp, gyerek≤létszám−1, dupla beküldés idempotens (advisory lock).

## INFO
- `/uploads/<tenantUuid>/<file>` nincs Host-ra szűrve (kell a uuid+64 bites név → alacsony).
- GET `?tab=uzenetek&open=<id>` olvasottra állít (állapotváltás GET-en); admin első megnyitása létrehozza az export-feed tokent.
- Generátor-napló „Nussbaum Panzió” párosítást írt (0,76 [high]) a Norah leadre, de Places-fotó/értékelés NEM került a mockba — csak napló-furcsaság.
- Teljesítmény egyébként jó: tenant-oldal 0,17 s, minta-honlap 0,27 s, admin 0,13–0,20 s.

## Takarítás
`_elek/cleanup.sh` (száraz alapból, `--go` commitol; mentés `/opt/citoviso/backups/elek-it-<ts>/`). A koordinátor „takaríts”-ára fut. A [TESZT] IT lead `84729ac7…`, forrás `51394a3c…` (Norah Apartman) intakt.
