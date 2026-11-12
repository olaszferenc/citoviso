# 2026-11-12 — Látogatás-mérés „lezáratlan” javítva (mobil záró jel + Tevékenység-oldal)

**Brief:** `~/rc-briefs/m-r-s-20261111-140301.md` (session `cit835f2052`)

**Tulaj jelzése (11-11):** „a látogatások mérésénél van valami gáz… nem következetes, sokszor lezáratlan” (képernyőkép: Eszter Apartman, 3 látogatás).

**Ok (élesen mérve 11-11):**
- A záró jel (`dwell_end`) csak `pagehide`-ra ment; mobilon (appváltás, telefonzár) ez nem sül el → 30 nap alatt 140/351 mobil, 17/90 asztali látogatásnak nem volt vége. Eszter 2–3. látogatása iOS Chrome, pár mp-es visszanézés: se dwell, se vége.
- Tevékenység-oldal: UTC idő (−1 óra), a `plan_view` „Egyéb esemény” volt, az eseményszám a rejtett `section_seen`-t is számolta.

**Elvégezve:**
- `assets/runtime/cit-configurator.js`: `dwell_end` `visibilitychange→hidden`-re is (visszatéréskor újraélesedik), valódi látható másodperccel; `pagehide` tartalék. Playwright-próba: új kód [7,10] mp, régi kód 0 záró jel.
- `src/console/views.ts`: budapesti idő, „Tervet nézett · N. terv”, eseményszám = látható sorok, záró jel nélkül „vége ismeretlen” + utolsó jel ideje.
- `scripts/outreach-reply-check.mts`: a 8–17-es ablak óta a mainen is piros volt — az elvárt időpont az ablak-konstansból.
- Land `80f63d64` (a tulaj kivételével a `mock-trial-overlay-check` kihagyva — a régi kóddal is piros); élesen a `7c6af883`-mal (prod/20261112-0817/0835) fut, igazolva.

**Nyitott:**
- `mock-trial-overlay-check` ⑪: card-sidebar 1536×864, süti-sávval a pirula-pár a kártya címsorán ül — minden `cit-configurator.js`-t érintő landot buktat.
- A land tiszta-main próbája diff-függő kapunál „zöld (0 s)”-t mond (a kapu nem is futott) — félrevezető.
- Tervváltásnál a dwell 0-ról indul (olvasási idő = max, nem összeg).
