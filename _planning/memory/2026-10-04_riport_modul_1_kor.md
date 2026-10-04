# Riport-modul a pilothoz — 1. kör: Tölcsér (B) + Viselkedés, kétrétegű kilépés-ok (2026-10-04)

**Szál:** koordináló fő session `citdce8f15d` (tulaj-szál) + SUB `citba3ddd8c` „Riport mérés-réteg"
(brief: `~/rc-briefs/riport-meres.md`). **ADR:** ADR-0322. **Kontraktus:** `assets/design-refs/console/riport/`
(tulaj: „B Mehet", 2026-10-04).

## Mit kért a tulaj
Átfogó riport a pilothoz: a mért linkek minden adata (kattintástól konverzióig, idők), eszköz, kilépés
és annak OKA, a vevők elmélyülése; pénzügy (bevétel, cashflow, tenant-kategória csomagokkal, modul-
kimutatás); tenant-admin aktivitás; tenant-forgalom változása. Döntései az egyeztetésben: három kör
(① tölcsér+viselkedés ② pénzügy+csomag ③ tenant-aktivitás+forgalom); csomag-besorolás SZÁMÍTOTT
(kezdő + aktuális, átsorolás a modulok alapján) + csomagon kívüli népszerű modulok; kilépés-ok KÉT
réteg (következtetett + kimondott mikro-kérdőív) egymáshoz kalibrálva; tenant-napló OK; digest e-mail;
mérés-egységesítés (UA → kinyert mezők, referrer → host, ADR-0108).

## Elkészült (landolva)
- `src/analytics/exitReason.ts` — 10 címke, küszöbök egy helyen; `scripts/exit-reason-check.mts` (16 eset) pre-commitban.
- `src/console/reportData.ts` — a kiküldött prospectek tényei egyszer betöltve, TS-fold (`foldReport`):
  tölcsér (payment-ből a „fizetve"), medián/p90 idők, hat hipotézis cél+ítélet+előző-időszak delta,
  visszatérés + eszkaláció, bontás 5 dimenzióban, kohorsz (7/14/30 n), napi idősor, viselkedés
  (eszköz, kilépési térkép szekció-aliasokkal, okok, kalibráció, gyors/mély vevő, nap×óra).
- `src/console/reportViews.ts` — `/report` (B kérdés-első) + `/report/behaviour`; szűrők = linkek,
  jegyzet = form (`POST /report/note` → `report_note`), SVG/CSS diagramok `<title>` tooltippel, csak
  tokenek, világos+sötét. Nav: a halott `#sent/#orders` helyett „Viselkedés". A régi `reportPage` törölve.
- Őrök: i18n-sources, ui-surface-scope, kb-check korpusz, console-dark-scan, i18n-pseudo-check,
  contract-drift (4 kötő felirat), kb-shot fixture (két kép), KB-entry a tudásbázis-őr leletei szerint.
- SUB: migráció **0087** (mock_view.device/os/browser/referrer_host, prospect_feedback, report_note,
  report_target, order_intent.preset, payment.pay_go_*) IGAZOLTAN FENT (3d9ea105); a 2–5. lépés
  (UA-kinyerés + backfill, section_seen/dwell_end/client_error/pay_go, converted/lost, mikro-kérdőív
  három ponton) a SUB-nál fut.

## Tanulságok (memóriába írva)
- Új őr-szkript FUTÓ commit alatt → guard-wiring-check bukik (lemezt néz).
- Követetlen `src/` fájl a landnál → planning-index utófeltétel bukik, a land „rebase-konfliktus"-t ír (hamis).
- `scripts/` nincs típus-ellenőrizve: egy törölt export (reportPage) csak a pszeudo-őr futásakor derült ki.
- Token-őr: csak a `citui.css` magban definiált token fogadható el — riport-árnyalat = `color-mix()` a használat helyén.

## SUB zárva (13:47, watchdog HANDOFF-RETIRE) — minden IGAZOLTAN FENT
`ead4e4a9` UA-kinyerés + backfill (dev: 685 sor, 253 bot) · `9560bc1e` section_seen / dwell_end{last_section,last_step} /
client_error / converted+lost / order_intent.preset / mikro-kérdőív három ponton (configurator-kártya, leiratkozó lap,
`/p/<t>/why` a levélből; POST dönt) · `5914d145` **pay_go ejtve (0088)** — koordinátor-döntés A: a `/pay/go` levél-link
GET-je nem számlál (ADR-0291 B, szkennerek), a kapu-átadást a `checkout_redirect` event méri · `65bab642` bot-látogatás
nem számít a riportban + a converted prospect 2. rendelése nem lép vissza. A kérdőív-képek: `_from-sub/ba3ddd8c/…`.

## ÉLESÍTVE (2026-10-04 15:16, tulaj „megadom", a backfillre „igen mehet")
`33e1b3fc` = `prod/20261004-1516` (előtte `0b1ee61f`); 217 fájl, migrációk 0086–0088 (pg_dump előtte), kanári 303/200,
`journalctl -p err` üres. A deploy előtt két kapu bukott, mindkettő MÁS szál elmaradása: a lead-lista `legend.png`
(kétszer — a 25b68545 landolása után újra) és a KB-őr FLAG-je a kézi szöveg-átírás B-útjának mobil-gesztusain —
mindkettőt én javítottam (`861f4106`, `09cf3689`, `33e1b3fc`). Backfill élesen: 14 sor, 0 nyers maradt (10 bot · 3 iOS
Safari · 1 Windows Chrome). Élesen 5 kiküldött link: 2 valódi (ma 10:00, még nincs emberi megnyitás) + 3 `[TESZT]`;
a tulaj kapcsoló helyett törlést kért: a két `[TESZT]` lead élesen törölve 14:15 (kaszkáddal: 2 prospect, 19 mock, 7 látogatás,
34 event; 21 mock-fájl a mentési mappába; teljes JSON-mentés `/opt/citoviso/backups/teszt-leads-20261004-141535/`;
előtte ellenőrizve: nincs tenant/rendelés/fizetés/számla rajtuk). A Muschel Panzió nem `[TESZT]`-nevű, maradt.

## Nyitott / következő
- ✅ Backfill élesen lefutott (lásd fent).
- **Meglévő mobil-hiba (nem a riporté):** a késleltetett süti-sáv az eszkalációs kártya „Most még gondolkodom" gombjára
  úszik és elnyeli a kattintást — pilot előtt javítandó, külön szál.
- Kicsik: `resubscribeProspect` a `lost`-ot nem állítja vissza; iPadOS 13+ Safari asztalinak látszik (szerver-oldalon nem
  különíthető el); a tenant-oldal device-a marad mobile|desktop.
- A lead-lapon a „valószínű ok" címke (exitReason) még nincs kitéve (README ⑮ második fele); ítélet-célok szerkesztő UI.
- **2. kör:** Pénzügy + csomag-lap (ADR-0322 ⑤, ⑦ digest) — ÚJ §2b terv kell (mock, tulaj-jóváhagyás).
- **3. kör:** tenant_activity + site_visit útvonallal + GBP-pillanatképek — új §2b terv.
- Élesítés: a nagy deployjal, nem külön (tulaj-szabály).
