# 2026-09-27 — Időszaki árak: dátumválasztó, névlista, év-naptár

**Kiváltó:** a tulaj a Camping Carina árak-képernyőjén (két képernyőkép): „nagy segítség lenne a dátumválasztó,
ráadásul a javasolt segítőszöveg sem egyértelmű”, majd „a szezon megnevezések szabad szavasak… legalább azt ajánlja
fel, amit eddig rögzített, mert így simán lehet Főszezon / főszezon / Föszezon”, és: „mi van, ha a következő évre
akar módosítani?”.

## Döntés-út (§2b)
- 1. kör: A naptár / B hónap+nap lista / C naptár+évsáv → „A + évsáv”.
- Kérdésére: a következő év már szerkeszthető az ADR-0221 évsávján (a Carinánál nem volt időszak, ezért nem látta);
  hiány volt, hogy ott is gépelni kellett → valódi, évszámos naptár.
- 2. kör: lenyíló névlista + év-naptár → „igen, jó!”, kérés: a naptár a gomb FÖLÖTT → „nagyon jó így”.

## Elvégezve (ADR-XXXX, nem élesítve)
- `src/server/moduleConfigViews.ts`: `seasonFields()` (add + szerkesztés közös, feliratos mezők), év-naptár panel
  (`data-ycal`), `seasonEditorScript(lang, today, names)` — az `L` szövegek + `data-season-names`; a régi gépelős
  előnézet kivéve; CSS (`.pn-*`, `.sdp-*`).
- `assets/runtime/cit-season-editor.js` (ÚJ): ismétlődő naptár (fixed, a gomb fölött; alatta ha nem fér), évsáv,
  névlista (combobox, billentyűvel), írásmód-jelzés, év-naptár (évszám, H–V, napok száma, „Napok mentése”).
- `src/tenant/prices.ts`: azonos (összevetett) név egy egységen belül → elutasítás (add + edit).
- Őrök: `scripts/season-year-price-check.mts` (naptár, elhelyezés, febr. 29 nap, névlista, írásmód, szerkesztő,
  év-naptár + mentés + szélesség, szerver-tiltás + pozitív kontroll), `scripts/pricing-booking-only-check.mts` ④
  (naptár-gombok, egy sor asztalon); `scripts/kb-shot.mts` `clickFirst` + 2 új kép; `scripts/i18n-sources.mjs`.
- Súgó: `kb/entries/admin-modules-pricing/entry.hu.md` + `screen.png`, `nincs-ar.png`, `naptar.png`, `ev-naptar.png`;
  tudásbázis-őr: PASS (a két nem blokkoló javaslata beépítve).
- Kontraktus: `assets/design-refs/tenant-admin/season-datepicker/` (plan.html + README + képek).

## Tanulságok
- Az `.adm-card{overflow:hidden}` miatt egy kártyán belüli, fölfelé nyíló felugró csak `position:fixed`-del él.
- A saját elhelyezés-állításom először mindkét irányt elfogadta (üresen zöld lett volna) — szigorítva, piros kontrollal.
- Az év-naptár félszélessége csak a súgó-képen látszott — a KÉP megnézése fogta meg, nem az őr.

## Nyitott
- A meglévő időszak SORA még nyers `06-15 – 08-31` alakot ír (nem része a tervnek) — ha zavar, apró javítás.
- A tulaj élő kipróbálása a Carinán (ott még nincs időszak — az első felvételkor a névlista üres, ez helyes).
