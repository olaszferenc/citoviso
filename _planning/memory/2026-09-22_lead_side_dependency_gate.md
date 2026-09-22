# 2026-09-22 — A modul-függőség a VÁSÁRLÁS pillanatában (ADR-0202)

**Mandátum:** `~/rc-briefs/lead-side-dependency-gate-brief.md` — tulajdonosi utasítás. Az ADR-0192
szabálya ott állt, ahol a tulaj már bent van (Modulok fül, megújítás-sweep), és ott hiányzott,
ahol a pénz ELŐSZÖR mozdul: a lead megvehette az **Online foglalást Árak nélkül**, kifizette, és a
konverzió pontosan azt élesítette. **Élesítés NEM volt a feladat.**

## Mit szállítottam

1. **A manifest szállítja a `requires`-t** (`src/generator/configurator.ts`) a katalógus `why`
   mondatával; a kontextus üres → `multiUnit = "unknown"` → a feltételes él a lead-oldalon ÁLL
   (ADR-0192 ④.4).
2. **A kosár bepipál és kimondja** (`assets/runtime/cit-configurator.js` +
   `cit-configurator.css`): tranzitív zárvány · „EGYÜTT JÁR" pirula · soronkénti indoklás a
   katalógusból · a vezérlő sorában a csoportosított ár · zárolás + visszavétel (KEEP).
3. **⭐ A beküldő végpont ELUTASÍT** (`src/console/server.ts`, `POST /configure/:id/request`):
   `400 module_dependency_unmet`, a hiányzó id-kkal és a `why`-jal. Ez az igazi védelem.
4. **Új őr:** `scripts/module-dependency-cart-check.mts` — **46 állítás**, böngészőben 390 px ÉS
   1280 px, plusz a kiszállított HTTP-végponton; `hooks/pre-commit`-be kötve.
5. Az ADR-0192 ⑥ őrének **NOT_COVERED** listája kiürült — de nem mutatóra cserélve: a
   `module-dependency-check` állítja, hogy a kosár-őr létezik ÉS hogy a hook lefuttatja.

## ⛔ Amit ez a kör megtanított

- ⛔⛔ **A saját őröm 39 állítása hamisan zöld volt.** A `check()` definíciója `(feltétel, címke)`
  volt, minden hívás a CÍMKÉT adta elsőnek — a nem üres sztring igaz. A kimenetben ott állt
  `✓ false ↳ 82px`: a lap KIÍRTA a bukást és zöldre értékelte. **Az argumentum-sorrend elrontása
  nem elírás, hanem néma kikapcsolás.** Az őr most típus-ellenőrzi a feltételt.
- ⭐ **A hamis zöld ELREJTETT egy valódi leletet.** A `82px` igaz volt: a pirula a nyers
  flex-sorban 82 px-es oszlopba préselte a modulnevet — 390 px-en ÉS 1280 px-en is, mert a panel
  fix szélességű, tehát „az asztalin biztos elfér" FELTEVÉS volt. A lelet csak akkor került elő,
  amikor az őr elkezdett igazat mondani.
- ⭐ **Az elrendezés-mérce ne fix pixelszám legyen, hanem ALAPVONAL.** Ugyanaz a sor pirula nélkül
  vs. pirulával. Egy fix küszöb vagy hamisan bukna egy rövid néven, vagy némán átengedné a
  szorítást egy hosszún.
- ⭐⭐ **A tulaj leállított egy védelmi ágat, és igaza volt.** A brief 3. lépéséhez (régi,
  érvénytelen rendelés konverziója) döntést kértem — a válasz: „DEVEN????? ERRE BASZNÁL EL
  TOKENT?". **Megmértem: dev 9 rendelésből 0 sértő, élesen szintén 0.** A kérdés helyes volt, a
  SÚLYA nem: egy nem létező eset gépezetét akartam megterveztetni. Mérj ELŐBB, és a kérdést a
  mérés mellé tedd — különben a döntéskérés is token-pazarlás.
- ⚠️ **A `page.evaluate` törzsében semmilyen névhez kötött függvény:** a tsx/esbuild `keepNames`-e
  `__name(...)`-t fűz hozzá, ami a böngészőben nem létezik → a mérés `ReferenceError`-ral HAL MEG,
  ahelyett hogy mérne. Egy meghaló mérés nem piros, hanem semmi.
- ⚠️ **A konfigurátor futása KISZOLGÁLÁSKOR injektálódik** (mérve: 0 tárolt artifact viseli a
  `data-cit-configurator` jelölőt). Ez tette biztonságossá, hogy a szerver elutasítson: régi
  mock-link is a MAI kosarat kapja. Enélkül a kapu valódi fizető vevőt tagadott volna meg.
- ⛔ **A 400-as ágnak KLIENS-ÁGA is kell.** A kezeletlen hiba némán a `showThanks()`-re esett
  volna: „Megkaptuk a rendelését" egy rendelésre, amit a szerver nem vett fel.

## Kapuk

`tsc` · `module-dependency-cart-check` (46/46, `--selftest` és teljes futás is) ·
`module-dependency-check` (negatív kontrollal igazolva: a hook-sort kivéve PIROS) ·
`module-config-lint` + `--selftest` · `module-upsell-check` · `entitlement-paid-check` ·
`guard-wiring-check` · `contract-drift-check` · `i18n-lint` · `extract-i18n --check` (5 új kulcs) ·
`design-token-lint` — mind zöld.

## §2b

A tulaj döntése: **kötött minta + kép-ellenőrzés, megállás nélkül** (a C kontraktus a MINTÁT köti,
a lead-keret más chrome). Négy kép ment ki (mobil 390 + asztali 1280 × vezérlő/behozott szerep) —
a lánc három sora három KÜLÖN csoportban áll, ezért nem fér egy képre.

## 🔴 Nyitott — a következő szálnak

1. A terv-sáv **csoportosított ár-blokkja** a Modulok fülön (a kontraktus §2 második fele).
2. A **`/pricing`** csomag-kártyák: a „nem eladó" jelvény ma MÁS halmazt mérne, mint a kiírt
   csomagár (`feedback_label_must_derive_from_predicate`).
3. A **három KB-szócikk** (ADR-0192 ⑥ vége) — a felirat-változás ugyanabban a commitban kéri a
   forrást, a félkövér idézetet és a `kb-shot`-ot.
4. A `_planning/DOMAIN/05-MODULES.md` függőségi szakasza.
5. Az ADR-0192 ⑧ **3–5. tétele** (mock fizetőoldal „éves" felirata · a `rooms` eltünteti a
   fizetett `amenities`-t · az előnézet ÍR, és az őre vak rá).
6. ⚠️ **A lánc három csoportra esik szét a kosárban** — ha a tulaj zavarónak találja a képen, a
   csoportosítás újragondolása külön kör.
