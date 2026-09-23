## ADR-0090 — Hero-cím olvashatóság (mérő-őr + garantált scrim) + fizetés-váltó az 1. lépésen

**Dátum:** 2026-09-01 · **Kiváltó:** tulajdonosi hibajelentés két képernyőképpel (Rozé Fogadó
mock + mobil fizetési modál). Két, egymástól független felület-hiba; a jóváhagyott irány mindkettőre
a **B** változat (AskUserQuestion, 2026-09-01). Kontraktus: `assets/design-refs/console/period-toggle-step1`
+ `assets/design-refs/engine/hero-contrast`.

**① Hero-cím olvashatóság — a hiba:** a fotó-overlay heróskban a főcím dőlt (akcent) része
`color-mix(var(--cit-accent), #fff)` = VILÁGOS szöveg, a fotó fölötti scrim viszont vagy statikus
gyenge (`fullbleed`/`parallax`/`cinematic`), vagy `--cit-bg`-alapú, ami LIGHT skinen eltűnik
(`dark-luxury`/`horizontal`). Világos fotón a cím olvashatatlan (Rozé Fogadó: **mérve 1,08:1**).

**Döntés (auto-javítás = B, garantált scrim):** a hero-szöveg mögé **skin-független, semleges sötét
scrim-alap** kerül a szöveg-sávban — a világos akcent-szín MEGMARAD (márka-karakter), a fotó sötétül
a cím mögött, fekete sáv nélkül (fokozatos gradiens). A `--cit-bg`-alapú scrimek megkapják a semleges
alapot, hogy az olvashatóság ne függjön a skin sötétségétől. 5 sablon módosult: `fullbleed`, `parallax`,
`cinematic`, `dark-luxury`, `horizontal`.

**Döntés (őr — a tulaj ezt kérte: „fel lehet állítani valami őrt?"):** `scripts/hero-contrast-check.mts`
— MÉR, nem tippel: minden sablont **worst-case világos** hero-fotóval renderel, Playwrighttal megméri
a hero-cím tényleges renderelt kontrasztját a mögötte lévő (scrim+fotó) képpont-átlag ellen
(a `palette.ts` WCAG `contrastRatio` képlete), és buktat a **3,0:1** (AA-nagybetű) küszöb alatt.
⭐ **Csak fotó-overlay heróskat mér:** ahol a cím tömör token-háttéren ül (pl. `brutalism` osztott
hero), ott nincs scrim → kizárva (az accent-on-bg más kérdés). Pre-commit-be kötve, ugyanazzal a
trigger-rel mint a `mobile-sticky-check` (engine template/skin/render változás). Fix után mind az 5
sablon **3,10–4,85:1**.

**② Fizetés-váltó az 1. lépésen (B — kártyás):** a `Havi/Éves` váltó eddig a konfigurátor 2. lépésén
(a „Tovább a megrendeléshez" után) ült, míg az **éves** ár már az 1. lépésen látszott váltó nélkül →
mobilon felfedezhetetlen (a lead nem találta, hogyan válthat havira). A váltó **átkerült az 1. lépés
láblécébe, közvetlenül az ÖSSZESEN ár fölé** (`.cit-cfg-permat` két opció-kártya, az éves kedvezmény
badge-ként), mindig látható a pinnelt láblécben mobilon is. Az **éves marad az alapértelmezett** (⚠️ FELÜLÍRVA: ADR-0211, 2026-09-23 — a havi az alapértelmezett)
(ADR-0080/tulaj-rendelet), a valós árazás (`pricing.ts`) és az ADR-0088 ajánlat-kártya változatlan.
A `configurator-price-check` az új class-ra (`.cit-cfg-popt`) horgonyoz. A felület-kapu (§2b) a
tervekkel/ui-shottal/jóváhagyással végigfutott.
