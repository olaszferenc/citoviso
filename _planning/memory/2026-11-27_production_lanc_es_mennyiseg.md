# 2026-11-27 — Production: lánc-utánpótlás, kinézeti szabálykörök, mennyiségi fordulat

**Session:** `cit96bd8170` (production, a tulaj fő szála). SUB-ok: lánc-utánpótlás `citf2359c67`, javító levél `cit8acda5c6`, levél-megnyitás riport `citab2df38a`; önálló: Számítási szerver `citde414ad3` (a tulaj gépköltözése: Contabo citoviso-2, szombat 11-28 20:00).

## Élesítések (prod tagek)
0729 ea3ab155 (slotfit1, v15) · 0932 9e76855d (kiküldés előtti saját megnyitás nem rögzül, 0160) · 1025 5882aaed (Amit kínálunk / Felszereltség, headings1, kolléga-kivétel ki) · 1136 35f2a6d1 (lánc-utánpótlás ADR-0500: régi mock újragenerálás, párhuzamos kapu, újrapróba, félkész elöl) · 1305 3b61791e (e-mail nélküli lead ki a láncból, ~1570 sor tartásba) · 1550 9a73a4e2 (mock 2. kör: fehér hős-cím, telt felszereltség, mondat vagy semmi a sávon, Parallax mindig) · 1625 6f8fab00 (tulaj Gmail-másolat) · 1728 51d5b1b1 (levél-megnyitás riport) · 1758 8a8c43e8 (mock 3. kör) · 1913 bbfef1ab (a v15+ kapu-passz átment marad). Utána: mennyiségi javítás (acec1a77) + javító levél (ADR-0508).

## Tanulság (a tulaj este: „egész nap ezzel lett elbaszva érzékelhető eredmény nélkül … minket csak egy dolog zavar, az a vevő”)
- A hat kinézeti szabálykör mindegyike bélyeget/kapu-verziót emelt, így a teljes kész állomány leesett a jóváhagyó lapról és újrarenderelődött a 2 magos gépen. Ma 57 kiküldés. Javítva: a v15+ pass átment marad; a csinosítási körök leállítva; a kolléga csak vevő-elriasztó hibát jelöl.
- Tulaj-elv: a mock TERV/techdemó — szakaszt soha ne hagyj el, töltsd fel.
- Levél-megnyitás (email_open, szkenner-szűrővel): Gmail kb. 44% nyit, a nyitók kb. 30%-a kattint, rendelés 0 — a szűk keresztmetszet a levél → mock → vevő út.

## Nyitva
- Javító levél (7 lead): élesítés után a chain-supply kijelöli és elkészíti; `bash ~/rc-briefs/uj-lanc-javito/javito-lanc.sh go` a deploy UTÁN (Kamilla/Bagoly új szöveg + átnéző). A tulaj Mehet-je után hétfőtől megy.
- 133 újraküldés tartva („csak a tulaj külön döntésére”), 87 régi auto-jóváhagyott visszament a láncba (mentés az éles gépen: backups/queued-unapproved-20261127.csv).
- HU kiküldési ablak ma 20:00-ig, utána 17 (leválasztott visszaállító, napló ~/rc-briefs/hu-ablak-visszaallitas-20261127.log).
- Lánc-SUB 4. kör félretéve (űrfelvétel-tiltás a településkép-tárban, mondatos sáv csak akcentszínen).

## Módosított fájlok (repó)
src/console/data.ts, src/console/server.ts, migrations/0160_presend_views.sql, src/engine/templates/parallax.ts, src/engine/moduleSections.ts, src/engine/amenityIcon.ts, src/i18n/catalog-context.json, scripts/qa-review.mts, src/outreach/mockPhotoGate.ts, src/outreach/mockRenderGate.ts, scripts/qa-review-check.mts, src/email/sender.ts, scripts/pilot-copy-check.mts, kb/entries/console-approval/entry.hu.md, MEMORY.md. Repón kívül: ~/rc-briefs/egylepes-elo/kor.sh (KL_PAR=2).
