## ADR-XXXX — A `mobile-chrome-check` párhuzamos munkásokkal mér, és az öntesztje a fő futással egy időben futhat (indokolt önátfedés-jelölés a kapu-futtatóban) (2026-09-29)

- **Kiváltó (tulaj, 2026-09-29):** a lassú-land vizsgálat (ADR-0260) javaslatára, a koordinátor
  kérdésére („Mehet az A + B? Ugyanez a szál csinálná meg, mert nála van a mérés.”): *„mehet”*.
  A = a kapu lapjai N párhuzamos kontextusban, ugyanazokkal az állításokkal; B = az önteszt és a fő
  futás ne egy láncban fusson. C (leghosszabb-először ütemezés) most NEM.
- **A kapu gazdája az ADR-0253 szál** (telefonos fejléc/sáv kontraktus). Amit a kapun változtattam,
  az CSAK az ütemezés; a lapok, a nézetek, a mérési lépések (`measure()`, `sweep()` 40 px-es
  lépései, `fillBooking()`, `menuChecks()`), a szabályok ①–⑤, a beültetett hibák és az önteszt
  ítélete változatlan.

**A mérés — előtte (ADR-0260):** a sablont érintő land kritikus útja ez a kapu volt: egyedül
**577 s**, a `--selftest` **164 s**, és a futtató egy szkriptet önmagával nem enged átfedni →
741 s EGY láncban; a 20 mért futásból a 13-ban, ahol lefutott, az ① fázis 530–922 s.

**Döntés**

1. **A — párhuzamos munkások a kapun belül.** A (nézet, lap) párokat `CIT_MCC_JOBS` (alapból 4)
   munkás veszi egy közös sorból. Minden munkásnak nézetenként SAJÁT böngésző-kontextusa van, és
   minden lap továbbra is FRISS lapon mér — a párhuzamos lapok nem osztoznak tárolón, `#fragment`-en,
   fókuszon. Az eredmények az eredeti (nézet, lap) sorrendben íródnak ki, tehát a kimenet ugyanaz,
   mint soros futásban. Eredmény nélküli pár = `⑤futás` bukás, sosem zöld; egy munkás kivétele a
   folyamatot nem-nulla kóddal állítja le (hangos). `CIT_MCC_JOBS=1` = a régi soros viselkedés.
2. **B — indokolt önátfedés-jelölés a futtatóban.** A futtató eddig minden szkriptet kizárt önmagával
   (mert `x --self-test` és `x` közös, munkafa-kulcsú scratch-útvonalakon osztozhat — ADR-0227 ②).
   Mostantól egy szkript fejlécében (első 40 sor) álló
   `// gate-runner: self-overlap-safe — <indok, legalább 20 karakter>` sor feloldja ezt RÁ; indok
   nélkül a jelölés nem számít. A `mobile-chrome-check` kapta meg: memóriában renderel
   (`setContent`), nem ír fájlt, sort, közös útvonalat (mérve: a forrásban nincs írás, a
   `CIT_SHOT=1` a szerver-oldali AI/DB-írást is tiltja). A hook szövege, a kapuk száma és sorai
   változatlanok (a `guard-wiring-check`/`gate-output-check` horgonyai érintetlenek).
   ⛔ Az „egy böngésző-indításban” változatot ELVETETTEM: a hook két kapu-sorát egyre kellett volna
   vonni — a kapuk száma csökkent volna.
3. **Őr — `gate-runner-check` H forgatókönyv:** az indokolt jelölésű fixture-szkript önmagával
   átfed; az indok nélküli („— ok”) NEM. Két új visszarontás (a jelölés hatástalan · indok nélküli
   jelölés is elég), mindkettő piros; a meglévő „szkript-kizárás ki” visszarontás továbbra is piros
   (a jelöletlen szkript nem fed át). 17 visszarontás, mind piros.
4. **A kapu saját öntesztje a negatív kontroll a párhuzamosság alatt is:** a 7 beültetett hiba
   mindegyike piros, a 2 tiszta lap zöld — párhuzamos munkásokkal, háromszor egymás után.

**Eredmény (mérve, a gépen közben 2–7 idegen kapu-futtató; load1 3,6–12,5):**

| | előtte (soros) | utána (4 munkás) |
|---|---|---|
| a kapu egyedül | **546 s** (ADR-0260-ban 577 s land alatt) | **189 · 182 · 163 s** (3/3 zöld) |
| `--selftest` egyedül | **158 s** (164 s) | **51 · 48 · 47 s** (3/3 zöld) |
| a lapok ítélet-sorai | — | 6/6 futásban BETŰRE azonos a soros futáséval |
| sablont érintő land kapusora (galéria land2, 84 kapu, gyorsítótár nélkül) | **960 s** (① 922 s) | **691 s** (① 656 s; load1 ~2–3) |

A land kritikus útja ezzel ÁTKERÜLT: a leglassabb kapu most a `lead-page-surface-check` (313 s),
utána `guest-mobile-check` 206 s, `mobile-chrome-check` 183 s, `room-details-check` 182 s,
`lead-mobile-check` 178 s. ⚠️ A két land-mérés nem azonos terhelés alatt futott (előtte load1 ~8,
utána ~2–3) — a 960 → 691 s különbség egy része a csendesebb gép; a kapu saját ideje (3×3 futás,
terhelten is) a tiszta mérőszám.

**Nyitva:** a következő jelölt ugyanerre a kezelésre a `lead-page-surface-check` és a
`guest-mobile-check` (gazdáik döntése, őrönként külön audit). A kapu most egy gépi slotban 4 lapot járat (ADR-0230: egy slot = egy kapu) — a
`CIT_MCC_JOBS` a slot-számmal együtt hangolható, ha a gép terhelése ezt kéri.
