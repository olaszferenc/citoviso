# 2026-09-26 — Mobil · Elek a VENDÉG szemével: a 19 stílus × 2 lead mockja telefonon (FK-010)

**Brief:** `~/rc-briefs/mobil-vendeg-nezet-brief.md` (szülő: `cite8fb512d`, testvér-szál: a LEAD-oldali burkolat).
**Tulajdonosi pontosítások a szál alatt:** ① *„Mindkét szál kiemelten a VIZUÁLIS ÉLMÉNYRE figyeljen … wow hatás”* → a leletlista első szempontja a 390 px-es kép, stílusonként wow-ítélettel; ② *„remélem ha van hiba akkor annak javítása a mock motorban történik”* → minden javítás a motorban (`src/engine`, `assets/runtime`), a `mock-*.html` kimenet, a bizonyíték az újrarenderelt lap.

## Mit mértünk és hogyan

- **Gépi mérés valódi telefon-kontextusban** (`scripts/guest-mobile-check.mts`, touch + mobil-flag, Playwright auto-scroll nélkül, saját görgetéssel és `getBoundingClientRect`-tel): 38 mock (Ifjúsági Szállás Tihany + Laguna Panzió, 19–19 stílus) × 3 nézet (390×844, 360×780, fekvő 844×390). Szabályok: ① túlfolyás / kicsinyítés · ② CTA az első képernyőn, ugrás a tapadó sáv alá · ③ érintési cél ≥ 44 px · ④ mező-betű ≥ 16 px · ⑤ takaró sáv · ⑥ naptár lapoz, két érintés = tartomány, fordított/múltbeli dátum üzenete, ár→gomb távolság, nyugta a képen · ⑦ szoba-felugró fér/görgethető/zárható · ⑧ nagyító · ⑨ vélemény-űrlap · ⑩ JS-hiba.
- **Elek FK-010** (`elek/scenarios/FK-010-guest-mobile-mock.md`, `felület: fájl`, `nézet: telefon`): 17 lépés, a runner telefon-kontextusban kattint, 390-es kép az elsődleges + fekvő + asztali. Vezénylő: `elek/bin/run-guest-mobile.mts` (19 × 2 mátrix, `MATRIX.md`). A runner két új diagnosztikát kapott: „nem látható” célpontnál a rejtő ős kiírása, és `ELEK_TRACE_JS` lépésenkénti nyomkövetés — ezzel derült ki, hogy a 10. lépés beragadása a SAJÁT forgatókönyvem hibája volt (egy ottfelejtett „előző hónap” kattintás).
- **Vizuális áttekintés:** 390 px-es „csík”-képek (2 képernyő/stílus/lead) + 19-es tablók: `elek/runs/FK-010-kepek/wow-*.png`, `hibak-elotte-utana-390.png`.

## Wow-ítélet stílusonként (390 px, első benyomás — mindkét lead képei alapján)

**Lenyűgöz:** dark-luxury (elegáns, tipográfia + sötét hero), fullbleed (fotó + lebegő foglalás-kártya), arch-frames (prémium, ív-keretes fotó — de nincs CTA az első képernyőn), watercolor (tiszta, ív-fotó, hullám), tilted-gallery (mozis nyitány), horizontal (sötétzöld, jó ritmus), aurora (erős tipó, kártyák).
**Rendben:** card-sidebar (app-szerű, generikus), claymorphism (barátságos), organic (blob-fotók), scrapbook (játékos), dopamine (harsány, de működik), editorial (újság-masthead, olvasható), parallax (bold caps), wordmark-grow (minimál, a név alig látszik).
**Szétesik telefonon (javítva a motorban):** **artdeco** (a poszter-cím kilógott a keretből: „sétatávolságra”, „kirándulásokhoz”; a fotó 150 px-es csík), **cinematic** (hero-szöveg 0 margóval a bal szélen, az alsor jobbra levágva, a foglalás-kártya címe a hero ALÁ bújt), **brutalism** („SÉTATÁVOLSÁG|ÁBAN” kötőjel nélkül; 12 fotós galéria 515 px-re szélesíti a lapot 390-en), **transit** (a szoba-táblázat 3 sora apró bélyegképpel, telefonon nem fér — kártyás sor lett).
**Adat-szintű, minden stílust érintő:** a Laguna hero-fotója (Google Places) alsó fele posterizált sötétkék folt — a hero-pontozó (92, „tiszta égbolt”) az eget nézte, a talajt nem; a 19 stílusból 12-ben ez az első kép. → jelezve a tulajnak (fotó-minőség kapu a hero-választásban, külön szál).

## Közös (widget/runtime) hibák — mind javítva a motorban

1. **Aurora: a felugró és a nagyító X-e a fejléc ALATT** — az aurora `body>*{z-index:1}` szabálya nyert a runtime z-indexén; most `!important`. (Elek FK-010 ugyanezt fogta: 5. lépés X-kattintás időtúllépés, a rákövetkező lépéseket a nyitva maradt felugró takarta.)
2. **Érintési célok:** naptár-léptető 21×30 → 44 (flex-shrink is javítva), vendégszám ± 40×42 → 44, felugró X 42 → 44, nagyító gombok 40 → 44, nap-cellák 35 → 38, dátum-mezők 26 → 44, ár-fül és szoba „Részletek/Foglalás” ≥ 44, masthead „Foglalás” 21 → 45 (a sor 12 px-es paddingja a linkbe költözött, a kinézet változatlan).
3. **Mező-betű 13,8–14,4 px → 16 px telefonon** (widget, dátum-sáv, vélemény-űrlap; a runtime CSS végén, a forrás-sorrend miatt).
4. **`.cit-btn` négy sablonban stílus nélkül** (arch-frames, claymorphism, tilted-gallery, wordmark-grow): 21 px-es nyers „Vélemény elküldése” gomb és 23 px-es CTA-link → `cit-fallback` rétegű gomb.
5. **Ugrás és nyugta a tapadó sáv alatt** (editorial, card-sidebar, cinematic, aurora, dark-luxury, fullbleed, horizontal…): a runtime méri a felső sávot (a görgetésre megjelenő, opacity:0-ról induló app-bar-t is), `--cit-stick` → `scroll-margin-top`.
6. **A lap szélesebb a készüléknél → a böngésző kicsinyít:** hero Ken Burns-háttér vágása, `minmax(0,1fr)` + `min-width:0` (card-sidebar, editorial-press archetípus, brutalism galéria, parallax kapcsolat-fotó), a MINTA-jelvény tördelhető.

**Eredmény (a két lead 38 mockja újrarenderelve a javított motorból, záró mérés):** 390 px: **132 → 0 HIBA** (113 ergonómiai lelet marad), 360 px: **133 → 0**, fekvő 844×390: **140 → 0**; kapu-mód (30 sablon+archetípus, 390): 0 HIBA; önteszt: 4 ültetett hiba piros. A megmaradt ERGONÓMIA-leletek: hibaüzenet ~750 px-re a dátum-sávtól és ár→gomb ~700 px (widget-elrendezés, §2b), a masthead-linkek 33 px (editorial/brutalism/tilted-gallery saját nav), szövegközi linkek 19 px, arch-frames/wordmark-grow: nincs CTA az első képernyőn és 0 link a fejlécben (tervezői döntés — a tulajé).

## Nyitott: §2b terv-kapu — a foglalás-widget telefonos elrendezése

Három MŰKÖDŐ vázlat a valódi runtime-ra építve (`assets/design-refs/_drafts/guest-mobile-booking/`, méret-váltó, @container): **A** üzenet a dátum-sáv alatt + „Tovább az adataimhoz ↓” · **B** két lépés (naptár+ár → összegző sáv + adatok) · **C** ragadó összegző sáv a widget alján. Mindhárom: hiba a dátum mellett egy képernyőn; asztalon a jóváhagyott kéthasábos elrendezés változatlan (mérve). Képek: `…/shots/`. **Várunk a tulaj döntésére; kód nincs.**

## Őr

`scripts/guest-mobile-check.mts` — pre-commit (runtime / sablon / archetípus / moduleSections / templateKit érintésekor): `--selftest` (4 ültetett hiba piros, tiszta lap zöld) + kapu-mód (30 sablon+archetípus, 390 px). ⚠️ Saját csapda: a kapu-módú `page.reload()` a `setContent` lapot `about:blank`-ra vitte, a ⑦⑧⑨ próbák némán kimaradtak — az önteszt fogta meg (memória: guard_greenly_defended_the_bug).

## Módosított / új fájlok

- ÚJ: `scripts/guest-mobile-check.mts`, `elek/scenarios/FK-010-guest-mobile-mock.md`, `elek/bin/run-guest-mobile.mts`, `_planning/decisions/XXXX-…md`
- Motor: `assets/runtime/cit-modules.css`, `assets/runtime/cit-runtime.js`, `src/engine/templateKit.ts`, `src/engine/primitives.ts`, `src/engine/archetypes.ts`, `src/engine/templates/{cinematic,artdeco,brutalism,transit,parallax}.ts`
- Elek: `elek/bin/runner.mts` (fájl-felület, telefon-nézet, `ELEK_RUN_TAG`, „nem látható” diagnosztika, `ELEK_TRACE_JS`), `src/elek/fkParse.ts` (`fájl`, `nézet:`)
- `hooks/pre-commit` (guest-mobile-check blokk)
- Nem commitolt bizonyíték: `elek/runs/guest-mobile-*`, `elek/runs/visual-390`, `elek/runs/FK-010-*`, `elek/runs/FK-010-kepek`

## Testvér-szálnak (→ testvér-szál)

A mock-fájlban nincs burkolat (a `/p/<token>` adja); a burkolat leletei nem ebben a mérésben vannak. A pre-commitben mindkét szál új blokkja külön helyen ül (övék ~718., miénk ~1528. sor).
