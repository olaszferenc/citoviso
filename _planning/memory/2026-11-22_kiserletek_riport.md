# 2026-11-22 — Riport „Kísérletek” fül + ár-sor dimenzió (citbeaa9a26)

**Kérés:** koordinátor `citb64f0ed0` — a tulaj a C tervet hagyta jóvá; befagyasztás, panel, hétfői sor, KB, land; élesítés nincs. ADR-0462 (6–7. pont).

## Elvégezve
- Terv befagyasztva: `assets/design-refs/console/kiserletek/` (`terv-C.html`, mobil + asztali kép, README a kötésekkel).
- Fül: `GET /report/experiments` — `src/console/experimentReport.ts` (adat: ítélet, KPI, hétfői sor, P(jobb)), `src/console/experimentViews.ts` (nézet), CSS `public/assets/ui/citui-console.css` (`xp-*`), fülsor (`reportViews.ts`), bal menü (`nav.ts`), útvonal (konzol-szerver).
- Hétfői sor: a Riportban (heti összefoglaló levél nincs); az előző lezárt budapesti hét.
- Ár-sor dimenzió: migráció `0144` (CHECK bővítve, `price_line` kontroll + `none` kikapcsolva); a motor (`experiment.ts`), a levél (`outreachEmail.ts` `noPriceBox`), a küldés (`sendBatch.ts`: a törzs a részekből újraépül, a §C-kapu a kész levelet ítéli); `composeBody` az üres `p3`/`fine` sort kihagyja.
- KB: `kb/entries/console-report-experiments/` (+ `kb-shot` fixture, `kb-check` nézet-lista).
- Önteszt: ⑧ riport (ítélet, hét-határ, hétfői sor), ⑨ ár-sor (doboz nélkül, mondat, kapu PASS, kontroll változatlan).

## Nyitott
- Változat-szövegek (megszólítás, E/1, feladó-név, ár-mondat): a koordinátor küldi, tulaj-jóváhagyás után kerülnek a katalógusba.
- Élesítés: a koordinátor „mehet”-jére.

## 3. kör (2026-11-22 délután)
- Mobil: a lenyitott tábla ≤760 px-en soronként kártya (koordinátor-javítás), README + KB frissítve.
- A személyes levél kikapcsolt változatai: migráció `0145`, szöveg `src/outreach/experimentCopy.ts` (T(), az i18n-forráslistán), HTML `buildPersonalMail` (`outreachEmail.ts`), küldés `sendBatch.ts` (`personalParts` + `composePersonalBody`), motor (`experiment.ts`: alkalmazhatóság, a `mondat` csak a személyessel). Önteszt ⑩.
- Piszkeri minta-levél (éles lead-adat csak olvasva: Cece, 4,8 ★ / 15): `assets/design-refs/_drafts/szemelyes-level/`.
- Nyitott: KERETEZÉS-FLAG a személyes levélen; az ár-mondat „…-tól az Öné” fordulata közel áll a levél-igazság-őr tiltólistás „forinttól az Öné”-jéhez.
