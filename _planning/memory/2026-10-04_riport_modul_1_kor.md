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

## Nyitott / következő
- ⛔ **Deploy-feltétel:** `npx tsx scripts/mock-view-backfill-ua.mts --go` élesen, visszaellenőrzés 0 nyers UA (jog-őr).
- **Meglévő mobil-hiba (nem a riporté):** a késleltetett süti-sáv az eszkalációs kártya „Most még gondolkodom" gombjára
  úszik és elnyeli a kattintást — pilot előtt javítandó, külön szál.
- Kicsik: `resubscribeProspect` a `lost`-ot nem állítja vissza; iPadOS 13+ Safari asztalinak látszik (szerver-oldalon nem
  különíthető el); a tenant-oldal device-a marad mobile|desktop.
- A lead-lapon a „valószínű ok" címke (exitReason) még nincs kitéve (README ⑮ második fele); ítélet-célok szerkesztő UI.
- **2. kör:** Pénzügy + csomag-lap (ADR-0322 ⑤, ⑦ digest) — ÚJ §2b terv kell (mock, tulaj-jóváhagyás).
- **3. kör:** tenant_activity + site_visit útvonallal + GBP-pillanatképek — új §2b terv.
- Élesítés: a nagy deployjal, nem külön (tulaj-szabály).
