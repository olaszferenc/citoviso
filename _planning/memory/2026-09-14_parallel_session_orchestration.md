# 2026-09-13/14 — 25 párhuzamos javító-szál levezénylése, Elek-méréssel és négy élesítéssel

**Státusz:** LEZÁRVA. `origin/main` = éles = `b029db8` (tag `prod/20260914-1200`).
Ez a jegyzet nem egy javításról szól, hanem a MUNKAMÓDRÓL: hogyan lett 25 párhuzamos
sessionből 4 deploy, és mit tanultunk közben a saját eszközeinkről.

## Miből indult

A tulaj kérése: „Elek, aki a Citoviso alkalmazottja, kézzel végigmegy mindenen, és hibát,
ergonómiai kellemetlenségeket és nem egyértelmű folyamatokat keres." Ehhez előbb futtatható
teszt-park kellett, mert a 12 FK-forgatókönyvből hidegindításon csak 3 futott zöldre — és a
piros **nem a terméket** jelentette.

## A négy szakasz

1. **A mérőeszköz megjavítása.** 12 FK → 3 zöld. A gyökér-ok: két beégetett UUID (a
   time-travel driverben és a booking-seedben) némán elhalt, mert a park a vásárlás-körből
   épül újra. Plusz a runner hibának minősítette a LANDOLT kattintást, ha a gomb eltüntette
   magát. Javítás után: **65/65 gépi zöld**, és megszületett az `elek/bin/run-all.mts`, ami
   EGY paranccsal felállítja a parkot a helyes függőségi sorrendben.
2. **8 hibajavító szál** (a tulaj választotta a 6 súlyosat + 2 ráadás), mindegyik saját
   sessionben, §2b terv-kapuval ott, ahol kinézeti döntés kellett.
3. **Elek teljes újramérése**: 12 kör, 110 kép, ~250 lelet — **0 REGRESSZIÓ** az 50+ commit
   után. A gépi mátrix 65/65 zöld volt, Elek ugyanezeken a képernyőkön **22 HIBÁT** talált.
4. **További 3 + 6 + 8 szál** a leletekből, négy élesítéssel.

## Amit a NAP TANÍTOTT — mind mérésből

### ⛔⛔ A gépies csere a súgón háromszor rontott el olyat, amit kézzel nem rontottam volna
A KB-kapu **11-szer** blokkolta a deployt, és mindannyiszor valós hibával. A legtanulságosabb
sorozat: a kivezetett neveket `sed`-del cseréltem — és a `/scrape` képernyő panel-címét
„Adatgyűjtés indítása"-ra írtam, holott ott **ma is „Scrape indítása" áll** (az átnevezés csak
a navigációra igaz). A javítás névelő-hibát szült („Az Scrape indítása"), a következő kör pedig
a nem-ítélhető ág kiútját mondta rosszul. **A sed nem tudja, melyik felirat melyik képernyőn
él, és nem tudja a magyar névelőt sem.** A KB-t a felület ellen kell szerkeszteni, egyesével.

### ⛔⛔ A KB-t nem elég a commit-üzenetből írni
Háromszor fordult elő, hogy a jóhiszemű összefoglaló pontatlanabb volt a valóságnál:
a szakasz-felirat és a `{done}/{total}` számláló a kódban **kizárja egymást** (ternárius), a
lezáró sáv **30 perc múlva eltűnik** (TTL), és a modul-előnézetnek **két külön felirata** van
(„Megnézem" vs. „Megnézem az oldalamon"), a kapuval csak az egyik ágon. Minden állítást a
KÓDBÓL kell mérni.

### ⛔ A purge többet vitt, mint amire szükség volt — és blokkolta a landolást
A teljes teszt-adat purge (4 tenant, 68 artefaktum, 29 rendelés) után **két őr nem tudott
futni**: a `help-collapse-check` tenant-fiókot, az `outreach-sendability-check` 3 prospectet
igényel. A kód rendben volt, a land mégis elbukott. **A helyes sorrend: előbb land, aztán
purge** — és a park helyreállítása (demo-tenant + mock-generálás + követett linkek) fél óra.

### ⚠️ A közös worktree kétszer okozott kölcsönös felülírást
A `rc-new.sh` a fő fába indít, nem külön worktree-be. Két session ugyanabban a fában dolgozott:
egyikük `cit-modules.css`-ét a másik felülírta, a mentés pedig elvitte a másik `INDEX.md`-sorait.
Mindkét szál maga vette észre és állította helyre — de az auto-worktree pool épp ezt hivatott
megelőzni. **Nyitott infra-tétel.**

### ⚠️ A MEMORY.md-be feloldatlan merge-konfliktus landolt
Két szál `## Aktív feladat` blokkja ütközött, és a `<<<<<<< HEAD` jelölők **felmentek a
mainre**. Ez a session zárásakor derült ki. Feloldva (a frissebb szál lett az aktív, a másik
előzőként alá). ⛔ A land-kapuk nem nézik a konfliktus-jelölőket — érdemes lenne egy egysoros
őr a `hooks/pre-commit`-be.

## Az orchestrálás mechanikája (a részletek: a saját memóriában)

- Állapot-olvasás `tmux capture-pane`-nel; a beragadt telefonos draftot `C-u` + `send-keys -l`
  + `Enter` kézbesíti (a felhő-oldal visszaírja, ezért a tartalmát muszáj beküldeni).
- A dizájn-kérdéseket a sessionből **ide** hoztam (`SendUserFile` + `AskUserQuestion`), a
  választ tmux-szal vissza — a tulaj EGY helyen dönt, a szálak nem várnak rá szétszórva.
- A közös park kizárási szabálya: a fagyasztás-mérés (FK-006) és az élő-parkot igénylő mérés
  (FK-007) nem futhat egyszerre; az időutazó minden köre +1 évet tol a fordulónapon.
  Visszaállítás: `scripts/reset-elek-billing-clock.mts --go`.

## Számok

- **25 javító-szál**, mind archiválva (`retired=True` a watchdog state-ben + tmux leállítva)
- **4 élesítés**: `23a1114` → `bd685a2` → `eacf4a6` → `b029db8`
- **Elek**: 12 kör, 110 kép, ~250 lelet, 0 regresszió
- A Barion-igénylés beadható; minden jogi oldal él

## Nyitva maradt

1. **A lead-LAP „Régió" sora** nyers azonosítót mutat (`views.ts:3148`) — a LISTÁT a `d7b8438`
   javította, a lapot nem. A súgó kimondja, a felület javítása külön tétel.
2. **A Területek szerkesztőjének megelőzése** (az operátor beírhat a doboza által cáfolt nevet)
   — tulajdonosi döntés: később, a lead-oldal optimalizálásakor.
3. **~160 ERGONÓMIA/ZAVAROS lelet** a `LELETEK.md`-kben — nem törések.
4. **MOBIL-VAKFOLT:** az Elek runner csak 1280px-es képeket készít, pedig a tulaj telefonon
   dolgozik. **Öt kiértékelő is jelezte**, hogy a telefonos nézetet senki nem tudta megítélni.
5. A `rc-new.sh` közös-fa gondja (lásd fent).
