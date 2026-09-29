# 2026-09-29 — A kapu-futtató a leghosszabb kaput indítja először (brief: kapu-leghosszabb-eloszor, „A” opció)

**Elvégezve (ADR-0265):** a `scripts/lib/gate-runner.mjs` minden futás után a `<git-common-dir>/cit-gate-history.json`-ba
írja a ténylegesen lefutott kapuk idejét (argv-kulcs, ½-½ mozgóátlag, tmp + rename, sérült fájl = nincs előzmény), és az
① fázis várakozó kapuit ez alapján csökkenő sorrendben indítja (előzmény nélküli elöl, stabil rendezés → előzmény nélkül
pontosan a hook-sorrend). Az író-sáv, a soros írók, az önkizárás és a gépi slotok változatlanok. Őr:
`scripts/gate-runner-check.mts` I forgatókönyv + 2 új visszarontás (19/19 piros).

**Mérés (f4dc1972~1...f4dc1972, 116 kapu, ugyanazon a fán):** ① 369 s → 275 s. Az összidő 1126 → 1218 s, mert a soros
`outreach-link-live-check` 299 → 675 s-ot szórt (élő link) — ez a következő szűk keresztmetszet, nem a rendezés hatása.

**Útközbeni lelet (átadva a koordinátornak):** a `lead-mobile-check --gate --selftest` a `9ad6652d...HEAD` diffen
(HEAD=af925571) párhuzamos hook-futásban 2/2 PIROS volt (R4_pill_and_panel + a pill-on-bar önteszt-ág), egyedül és a
main-próbán zöld. Terhelés-érzékenység gyanúja az ADR-0263 óta; nem vizsgáltam tovább.

**Csapda, amibe belefutottam:** egy követetlen `XXXX-…` ADR-fájl a fában a `planning-index` kaput pirosra viszi egy kézi
`LAND_RANGE=… bash hooks/pre-commit` mérésnél — mérés idejére a fán kívül tartsd. A main-próba a bukott kaput újra
futtatja a futtatóval és felülírja a `CIT_GATE_TIMES` fájlt (bukott mérésnél a TSV csak a próba sorát tartalmazza).

**Módosított fájlok:** `scripts/lib/gate-runner.mjs`, `scripts/gate-runner-check.mts`,
`_planning/decisions/XXXX-a-kapu-futtato-a-leghosszabb-kaput-inditja-eloszor.md`, ez a jegyzet.

**Nyitva:** az `outreach-link-live-check` a soros sáv farka (és szór); a `CIT_GATE_JOBS` emelése („C” opció).
