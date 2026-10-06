# Riport — Rendelés-panel: a gombnyomás és a panelen belüli út (A + B)

Tulajdonosi jóváhagyás: 2026-10-06 („mindkettő” — az A és a B változat EGYÜTT). Vázlat:
`rendeles-panel.html` (méret- és változatváltóval), képek: `ui-{A,B}-{desktop,mobile}.png`.
**Ez a terv KÖT** — elvárt viselkedés, nem stílus-javaslat. A számok a vázlatban pilot-alakú
MINTA (40 megnyitó, 12 panel-munkamenet), nem valós adat; a sárga keretes „élesen ma” sor
a lap megvalósításában NEM szerepel (az a vázlat tényállása volt: 16 éles megnyitás, 0 gombnyomás).

**Hatókör:** `src/console/reportData.ts` · `src/console/reportViews.ts` · `src/console/views.ts`
(`EVENT_LABEL` + `prospectActivityPage`) · `assets/runtime/cit-configurator.js` · KB (`console.report`).

## Miért létezik

A tulaj kérése (2026-10-06): „Az is legyen mérve a kiküldött linkben, hogy meg van-e nyitva az
Itt rendelhetem meg gomb, és azon belül mi történik.” A gombnyomás (`panel_open`) és a panelen
belüli lépések már rögzülnek (`mock_event`), de a riport a `Visit.panelOpened`-et kiszámolja és
sehol nem mutatja, a lépcsőt nem összesíti, a lead Tevékenység lapja pedig több panel-eseményt
nyers kóddal ír ki (`checkout_step`, `billing_step_open`, `module_info`, `panel_collapse` …).

## Amit a terv KÖT

### Új mérés (a konfigurátorban)

1. `panel_open` payloadja megmondja, HONNAN nyílt: `{ via: "pill" | "esc" | "tab" }` — a gomb
   (`.cit-cfg-launch`), az eszkalációs ajánlat gombja, a szél-fül (`.cit-cfg-handle`).
   A régi, `via` nélküli `panel_open` a riportban „gomb”-nak számít (akkor csak az volt).
2. A panel X-es bezárása is esemény (`panel_close`); ma csak az összecsukás (`panel_collapse`) mért.
3. Idő a panelben: a nyitástól az összecsukásig / bezárásig / a lap elhagyásáig (`dwell_end`-kor
   a nyitott panel ideje is), másodpercben — ebből a medián és a p90.
   ⛔ A mérés semmit nem rögzít `?sajat=1`-es, leiratkozott vagy már vásárolt látogatónál
   (ADR-0327/0112, a mai `TRACK` feltétel változatlan).

### Viselkedés lap — új „Rendelés-panel” panel (mindkét változat egy panelben)

4. Cím: Rendelés-panel — alcím: megnyomta-e az „Itt rendelheti meg” gombot, és mi történt benne.
5. Szűrő-chipek (a panel saját szűrője, a lap időszak/bontás szűrője ALATT): Mind · A gombbal ·
   Az ajánlatból · Szél-füllel újra. Minden szám a panelen erre számolódik újra.
6. Négy KPI: Megnyomta a gombot (N / megnyitó, % — mindig a gombra, a chip nem szűri) ·
   Panelt megnyitott (db; „Mind”-nél gomb · ajánlat · fül bontással) · Medián idő a panelben
   (p90-nel) · Rendelés nélkül zárta (db, % + ebből hibába futott).
7. **A — lépcső:** Megnyitotta → Tovább (`checkout_step`) → Számlázás (`billing_step_open`) →
   Elküldte (`order_intent_submitted`) → Fizetésre ment (`checkout_redirect`) → Fizetett
   (`payment.status='paid'`, a payment-táblából, NEM a prospect státuszából). Sávonként „N · %”
   a panelt megnyitók közül, jobbra „itt abbahagyta” db; a legtöbbet vesztő lépés
   `--citui-bad-ink`. Mellette „Mit csinált közben”: csomagváltás, modul ki/be, ciklusváltás,
   modul-leírás, domain keresés/választás, saját domain ellenőrzés, összecsukás — fő szerint
   (egy lead több sort is adhat); hiba-sorok (hibás számlázási adat `billing_invalid`, a beküldés
   nem sikerült `order_send_failed`) pirosak.
8. **B — leadenként** (a lépcső ALATT, ugyanabban a panelben): összegző mondat („N lead nyitotta
   meg a panelt · X elküldte a rendelést · Y fizetett”), majd lista a legfrissebb elöl: Lead ·
   Mikor · Eszköz · Hogyan · Idő a panelben · Lépések (6 pötty: telített = elérte, zöld =
   fizetett) · Utolsó lépés (pirula; hiba esetén piros „· hiba”). Sorra kattintva kibomlik a
   panelen belüli idővonal (időpont + magyar felirat + részlet). Asztalin tábla, mobilon kártya
   (`@container`); a lead neve a lead Tevékenység lapjára visz.
9. Egy munkamenet = egy látogatás (`mock_view`), amelyben volt `panel_open`; egy lead több sort is
   adhat (visszatért). Csak KIKÜLDÖTT linkek (ADR-0139), mint a riport többi része.

### Lead Tevékenység lapja

10. Minden konfigurátor-esemény magyar feliratot kap (`EVENT_LABEL`), nyers kód nem jelenhet meg:
    a vázlat alsó panelje mutatja a formát (pl. „Megnyomta: „Itt rendelheti meg””, „Továbblépett
    (domain-választás)”, „Megnyitotta a számlázási adatokat”, „Hibás számlázási adat”, kiemelve
    „ELKÜLDTE A MEGRENDELÉST” és „Továbbment a fizetéshez (Barion)”). A `via` a nyitás mellett
    zárójelben (az ajánlatból / szél-füllel újra). A `section_seen` sorok itt nem kellenek.

### Közös

11. Csak `--citui-*` tokenek, egy hue (link-ink) + szürke, piros csak a vesztő lépés / hiba;
    világos és sötét mód; minden sávnak száma is van. i18n: minden felirat `T()`-n át (§B.18).
