# 2026-09-26 — „Itt rendelheti meg”: a lead-lap rendelő gombja mindig kint van, platform-színű, a Foglalás-sáv fölött (C szál)

**Brief:** `~/rc-briefs/cfg-mobile-0926/C-inditogomb.md` (+ `_kozos.md`). Ez a C szál a telefonos rendelés-bejelentés három
párhuzamos szálából (A: két lépés, B: görgetés). ADR: `ADR-0242` (a land osztja ki). Kontraktus:
`assets/design-refs/prospect-page/order-pill/`. Nincs élesítve, a nagy deployjal megy.

## Mit mértem a kódban (a bejelentés mögött)

- `collapse()` (fül, mellé-koppintás, Esc) → `launch.hidden = true`; csak egy felirat nélküli perem-fül maradt.
- Betöltéskor `setTimeout(showPill, 2600)`, illetve az első görgetés: addig nem volt vásárlási belépő.
- A háttér `var(--cit-accent)` volt, vagyis maga a mock CTA-színe; a 19 Három Huszár stílus akcentje mind vörös, lazac
  vagy rózsa, kettő türkiz (claymorphism, wordmark-grow, `#3fb2b2`).
- A `placeLaunch` az oszlopában MINDEN fő gomb fölé felmászott, a lappal együtt mozgókéra is: a dark-luxury-n 390 px-en
  a hős-gombok fölé, a bevezető szövegre.

## §2b terv-kör

Valódi Három Huszár mockok, a valódi `injectConfigurator`-ral (nem rajzolt vázlat), a javasolt viselkedés szöveg-patch-ként;
5 stílus; A (fix cián) · B (cián, türkiz akcentnél lila) · C (fekete-fehér kontraszt-pirula); Playwright 45/45.
⚠️ A „B + Foglalás-sáv fölé” válasz ELŐSZÖR a koordinátor-sessionből jött, tévedésből (egy beküldött prompt-javaslat).
Leállítottam, a fában a státuszt „NEM JÓVÁHAGYOTT”-ra írtam, és újra megkérdeztem. A kérdőívre B és Foglalás-sáv fölött
volt a válasz; a tulaj a koordinátornak megerősítette, hogy ő válaszolt.

## Amit megépítettem

- Felirat „Itt rendelheti meg”, aria „Itt rendelheti meg a saját weboldalát” (`tr`, katalógus); FK-009 két `várj` sora.
- A gomb 0,3 mp után beúszik; lecsukás és bezárás után kint van; lecsukva a perem-fül rejtve (CSS).
- Szín: `--cit-lp` cián `#1fb6d6` / `#06131b`, fehér perem, pulzáló gyűrű. `pickLaunchColour()`: ha az akcent színköri
  távolsága a ciántól < 45°, akkor `cit-cfg-launch--alt` (lila `#6d4aff` / fehér).
- Hely: `fixedBottomTop()` (a képernyő aljához rögzített legfelső réteg) − 10 px; ha oda egy lappal együtt mozgó fő gomb
  esne, oldalt vált (`--l`/`--r`: telefon jobb→bal, asztal közép→jobb→bal), és csak ha minden oldal foglalt, akkor lép
  feljebb a régi módon. Az `cit-cfg-avoid` blokk-jelölők maradtak (az őr piros öntesztje kivágja).
- `configurator-float-check`: `FALLBACK_MS` 2600 → 300 (a termék állandója), költségvetés 7,1 → 4,8 mp.

## Mérés

- Saját mérés, 19 stílus × 390 / asztali / fekvő: **57/57 OK, 0 JS-hiba**. Mérve betöltéskor, nyitásnál, lecsukás, Esc és X
  után, valamint görgetés közben 25/50/75/100 %-nál: látható, a képernyőn belül, `elementFromPoint` = a gomb, 0 betemetett
  fő gomb, alsó éle ≤ a rögzített réteg teteje. 6 nézetben oldalt váltott. Lila: claymorphism, wordmark-grow.
- `lead-page-surface-check` ✅ · `configurator-float-check` ✅ · `i18n-lint` ✅ · `design-token-lint` ✅.

## A pre-commit kapu megfogta a saját hibámat

Az első commit-kísérletnél a `lead-mobile-check` önteszt „overflow” ága az R4-et is pirosra vitte. A kapu fixture-je
SÜTI-SÁVVAL fut, és a sablon Foglalás-sávja a süti-sávra rétegződik (alja = képernyő alja − 125 px). Az első
`fixedBottomTop()` csak a képernyő alsó 40 px-ébe érő rétegeket nézte, a sávot nem látta, így a pirula RÁ ült;
túlfolyásnál a Playwright koppintását a `t-mobcta` fogta el. Az 57-es saját mérésem süti-sáv nélkül futott,
ezért vak volt rá. Javítás: a süti-sáv tetejétől is számít. Új őr: R8 (átfedés-mérés, a koppintás pillanatában) +
„pill-on-bar” visszarontás; közben az aurora teljes képernyős dekor-háttere hamis találat volt (> 60 % → kizárva).
Tanulság: egy „fölötte ül” állítást azon a lapon mérj, ahol az összes réteg kint van (süti-sáv is).

## Módosított fájlok

`assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css`, `src/i18n/catalog.json`,
`elek/scenarios/FK-009-lead-mobile-first-open.md`, `scripts/configurator-float-check.mts`, `scripts/lead-mobile-check.mts` (R8 + önteszt),
`_planning/decisions/XXXX-itt-rendelheti-meg-a-rendelo-gomb-mindig-kint-van.md`, `assets/design-refs/prospect-page/order-pill/*`.

## Nyitva

- A süti-sávval együtt nem a kiküldött `/p/` lapon mértem, hanem az injektált mockon; a `lead-mobile-check --gate` a
  pre-commit/land kapuban fut.
- A régi `first-screen-compact` terv képei a régi feliratot mutatják (történeti, nem íródik át).
- Az élő mock-fájlok a konfigurátort kiszolgáláskor kapják, tehát a landolás után azonnal az új gombot mutatják.
