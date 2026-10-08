# Riport — Mock fül: melyik mock mennyire vonzó (B + C hibrid)

Tulajdonosi jóváhagyás: 2026-10-08 („Oké, jóváhagyom. Mehet így.”), az 1. kör A/B/C változatából
a tulaj a B és a C hibridjét választotta. Vázlat: `riport-mock.html` (méretváltóval), képek:
`ui-{desktop,mobile}.png` (kezdőállapot), `ui-{desktop,mobile}-kapunyitas.png` (egy kártya kiválasztva).
Ez a terv KÖT: elvárt viselkedés, nem stílus-javaslat. A vázlat adata VALÓS éles minta
(2026-10-08, 158 kiküldött mock, read-only lekérdezés); a lap a saját DB-jéből számol.

**Hatókör:** `src/console/reportData.ts` · `src/console/reportViews.ts` · `src/console/server.ts` ·
`src/console/nav.ts` · KB (`console.report`).
Az adat a meglévő `loadProspectFacts` fold (ugyanazok a tények, mint a Tölcsér és a Viselkedés lapon);
új lap `GET /report/mock`, a Riport csoport 3. levele.

## Miért létezik

A tulaj kérése (2026-10-08): „a report/megkeresés felületen kell egy Mock tab. Ahol látszik hogy
melyik mock mennyire vonzó”. A tulaj ebből látja, melyik sablon működik.

## Amit a terv KÖT

1. **Fül:** a Riport fülsorában harmadikként: Megkeresés-tölcsér · Viselkedés · Mock (`/report/mock`).
2. **Szűrők:** időszak (7 / 30 / 90 nap / Összes, a kiküldés dátuma szerint) és csatorna
   (Mind / E-mail / MMS-SMS) — mint a többi riport-lapon, query-paraméterben (link, JS nélkül is megy).
3. **Mi számít:** csak a KIKÜLDÖTT link (`prospect.sent_at`); a bot-nézet kiesik (`deviceOf` = bot);
   a `?sajat=1` megnyitás eleve nem mér. A magyarázó doboz ezt kimondja.
4. **Ítélet-panel** („Mit mondanak a számok?”): a legalább 10 kiküldésű sablonok közül a legtöbbször
   és a legkevesebbszer megnyitottat nevezi meg, az átlaggal; a 95%-os (Wilson) tartományokból
   kimondja, hogy a különbség még belefér-e a véletlenbe. Két ilyen sablon híján: nem lehet összevetni.
5. **Sablon-kártyák** (bontás: `inputs.template`, a sablon felirata a ` — ` előtti rész):
   első a Minden sablon kártya, utána sablononként. Kártyán: kiküldve, kevés adat jel (<10 kiküldés),
   lépcső a kiküldöttek %-ában — Megnyitotta → ≥1 percet nézte → Végiggörgette (≥75%) →
   Visszatért (≥2 látogatás) → Panel / válasz (rendelés-panel VAGY válasz VAGY rendelés); az összes
   mock átlaga függőleges vonal a sávon; „Megnyitás az átlaghoz képest: ±N pont”; alul az átlagos
   vonzóság-pont.
6. **Kártya = szűrő:** kattintásra (és Enterrel) a lenti lista a sablonra szűr, a kártya kijelölt;
   „Szűrve: X · Minden sablon” visszavonó; ugyanarra kattintva a szűrés megszűnik. Mobilon a
   kattintás után a lista a képbe gördül. JS nélkül link (`?tpl=`).
7. **Vonzóság-pont (0–100) mockonként:** megnyitotta 20 · visszatért 15 · ≥1 percet töltött rajta 15 ·
   végiggörgette (≥75%) 15 · megnyitotta a rendelés-panelt 15 · válaszolt (`outreach_reply`) 10 ·
   rendelt (`order_intent`, initial) 10. Leiratkozás = 0 pont. A képlet a lapon ki van írva.
8. **Mocklista:** pont-jelvény, szállás neve, jelek (6 pötty: megnyitotta · visszatért · ≥1 perc ·
   végiggörgette · panel · zöld = válasz/rendelés, piros = leiratkozott), megnyitások száma, idő,
   görgetés; alsor: sablon · arculat · csatorna · kiküldés ideje (Budapest) · első megnyitás ideje.
   Kereső a szállás nevére, rendezés: Legvonzóbb / Legutóbbi / Leghosszabb idő; 25-ösével
   „Több mutatása”. A név a lead-oldalra visz.
9. **Méretek:** asztalin a kártyák 3 oszlopban, a lista oszlopos; mobilon (390 px) egy oszlop,
   a lista sorai kétsorosak. Vízszintes görgetés nincs.

Az idő = a látogatásonként mért, oldalon töltött idő ÖSSZEGE (a `foldVisit` `dwellSeconds`-a).
