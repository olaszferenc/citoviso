# 2026-10-05 — CRM-widget: a két mock-sor (jóváhagyásra vár / kiküldésre vár) + Lead-sor szűrő

**Kérés (tulaj, brief + képernyőkép az Irányítópultról):** a CRM-kártyára kerüljön be a
„generált, jóvá nem hagyott mock” és a „jóváhagyott, ki nem küldött mock” leadszáma, és a
Lead-sorban lehessen rájuk szűrni.

## Elvégezve
- CRM-kártya (Irányítópult + /hub/crm) két új sora, LEADENKÉNT, a diszkvalifikáltak nélkül:
  „Generált, jóvá nem hagyott mock (lead)” → `/leads?mock=generated`;
  „Jóváhagyott, ki nem küldött mock (lead)” → `/leads?mock=approved_unsent`.
- Új Mock-szűrő kód: `approved_unsent` („jóváhagyva, nincs kiküldve”) — a meglévő VAGY-szűrőből
  az „approved ÉS NEM kiküldve” nem rakható össze, ezért saját cella-tag (`isApprovedUnsent`).
- Számláló: `countMockQueues()` (data.ts) — ugyanaz a pool (inner joinok, diszkvalifikált nélkül),
  `pickShownMock`, `prospect.sent_at`; a nav-szám cache-ében (navCounts, 15 s). Dev-DB-n mérve:
  7 / 5, a lista ugyanennyit ad.
- Mellékjavítás: a Mock-oszlop rendezési kulcsa a „✓ kiküldve” jelet is tartalmazza (eddig a
  kiküldött és a nem kiküldött „jóváhagyva” sorok holtversenyben keveredtek — az őr új
  fixture-sora fogta meg).
- Őr: `lead-filter-label-check` új blokk az `approved_unsent` szűrőre; `console-linear-check` fixture.
- KB: `console-dashboard`, `console-leads` frissítve. A dashboard súgó-képe (screen.png) régi
  marad — a kép frissessége deploy-kapu (ADR-0220), nem commit-kapu.

## Döntés
- A menübe (oldalsáv) NEM került új pont — a tulaj képe a CRM-kártyát jelölte meg „ide”-ként.

## Fájlok
- src/console/leadFilters.ts, src/console/data.ts, src/console/navCounts.ts, src/console/nav.ts,
  src/console/views.ts, src/i18n/catalog.json, scripts/lead-filter-label-check.mts,
  scripts/console-linear-check.mts, kb/entries/console-dashboard/entry.hu.md,
  kb/entries/console-leads/entry.hu.md
