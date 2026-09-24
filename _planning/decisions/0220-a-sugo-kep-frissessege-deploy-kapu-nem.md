## ADR-0220 — A súgó-kép frissessége deploy-KAPU, nem figyelmeztetés — előfeltétele a determinisztikus képgyártó (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva, lokálban igazolva) · **Kapcsolódó:**
ADR-0045/f (tudás-őr a deploy-csőben — a 1c) WARN-t és a 3. „elvetett: pixel-diff" pontját
ez az ADR FELÜLÍRJA), ADR-0207 (fordítás = deploy kapuja), ADR-0053 (deploy = megnevezett commit).

**Kontextus.** 2026-09-23-án pixel-szinten mérve (három `kb-shot` futás ugyanazon a commiton):
- **4 commitolt súgó-kép ELAVULT volt** a mainen (köztük a `console-pricing`, ami egy MEGSZŰNT
  modul-nevet mutatott) — a deploy GATE 1c ezt csak WARN-ként jelezte („view változott,
  screenshot nem"), és azt is csak akkor, ha a tartományban egyetlen entry-asset sem változott.
  Egy CSS- vagy fixture-változás egyáltalán nem riasztott.
- **2 kép NEM volt determinisztikus** (`console-lead/source-panel.png` 7 623 px: a ragadó fülsor-
  mondat hol a tartalomra festve, hol nem; `console-leads/screen.png` 3 417 px: a táblázat ragadó
  fejléce hol eltolva, hol nem). Ebben a sessionben továbbiak: az `outreach-draft` felső sávja
  1–2 px-et mozgott (betűtípus a capture UTÁN állt be), és a lead-lista fejlécének alsó vonala
  hol teljes, hol csonka volt (892 px, a sticky réteg kompozitálása).
Az ADR-0045/f jogosan vetette el a pixel-diffet: egy nem-determinisztikus gyártóra épített kapu
zajra bukik. A megoldás ezért KÉT lépés, ebben a sorrendben.

**Döntés.**
1. **Determinisztikus képgyártó (előfeltétel).** A `kb-shot` minden felvétele az egyetlen
   felvételi úton (`snap()`) előbb `settle()`-en megy át: animáció/átmenet/kurzor ki; betűtípusok
   (`document.fonts.ready`) és képek bevárva (a lazy kép eager-re, különben sosem töltődik be);
   a görgetés explicit (viewport-képnél a horgonyra vagy a lap tetejére, a konzol horgony-görgetése
   `hashchange`-dzsel újrafuttatva); a ragadó elemek a természetes helyükre (`static`) — elem-képnél
   mind, viewport-képnél csak amelyik NEM tapad éppen (pixelre ugyanaz, de determinisztikus; ami
   ténylegesen tapad, pl. alsó sáv, marad, mert a tulaj így látja); két képkocka. A beállás 15 s
   után HANGOSAN bukik (egy lazy kép némán megakasztotta az egész futást).
   **Próbája:** `npx tsx scripts/kb-shot.mts --determinism` — két független gyártás ideiglenes
   könyvtárba, pixel-összevetés; eltérés = piros, képnév + bbox.
2. **Kapu: GATE 1c/kép a `deploy-prod.sh`-ban.** A cél-commit SAJÁT worktree-jében
   `kb-shot --check-committed`: újragyárt egy ideiglenes könyvtárba, és pixel-szinten összeveti a
   commitolt képekkel. Bármely eltérés (vagy commitolatlan új kép) = a deploy MEGÁLL, a hiba
   megnevezi a képet és a bbox-ot. MINDEN deployon fut (nem csak KB-releváns diffnél: CSS és
   fixture is elavít képet). A régi WARN kivezetve. Külön, csak-lokálisan is futtatható:
   `bash scripts/deploy-prod.sh --kb-shot-gate <commit>`.
3. **Pixel-összevetés küszöbbel** (`scripts/lib/png-pixel-diff.mts`): egy pixel akkor eltérő, ha
   valamelyik csatornája >24-gyel mozdul — az élsimítási zaj alatta marad (mérve: `arak.png`,
   0 px a küszöb fölött), valódi tartalom-változás messze fölötte.
4. **A munkamegosztás (tulaj elvi döntése, 2026-09-23):** a magyar súgó-SZÖVEG commitkor készül
   (a változtató session írja, amíg megvan a kontextusa); a teljes súgó ellenőrzése + a képek
   frissessége + a fordítás deploykor kapu (ADR-0207 mintája).

**Határok / ismert kockázatok.**
- A képek a DEV adatbázis modul-katalógusából renderelnek (`getTenantModules`): ha a dev DB
  modul-ára/-neve változik, a kapu elavultnak mondja a képet → újragyártás + commit. Szándékos:
  a kép a katalógus állapotát mutatja. DB nélkül az `--out` gyártás hangosan bukik (nem ad üres
  Modulok-képet „elavult" címkével).
- Egy ADR-0220 ELŐTTI commit `kb-shot`-ja nem ismeri a `--check-committed`-et → a kapu bukik
  („nem igazolható"). ⚠️ Ez egy ilyen commitra való VISSZAGÖRGETÉST is megállít — tudatos
  kompromisszum, a tulaj döntheti felül.
- Chromium- vagy rendszer-betűtípus-frissítés a dev gépen minden képet elmozdíthat → egyszeri
  újragyártás. A `partner-kb-shot.mts` képei nincsenek a kapu alatt (külön gyártó).

**Őrök / próbák (mérve, 2026-09-23).** Determinizmus: `--determinism` zöld nyugalomban és 8 szálas
CPU-terhelés alatt; szándékos ingadozással (véletlen késleltetés a sticky-feloldás előtt) piros.
Kapu: szándékosan elavított commitolt képpel piros (képnév + bbox), a friss képpel zöld.
A kb-shot `--self-test` szerkezeti próbája továbbra is kikényszeríti, hogy minden felvétel a
`snap()`-en (és így a `settle()`-en) menjen át.

**Újragyártott képek (a beállt állapot, mérve a régihez):** `console-leads/screen.png` (a Név
oszlop elválasztója — a lap szkriptje által mért `is-scrollx` — a régin hiányzott, mert a felvétel
a mérés előtt készült; a fejléc alsó vonala teljes), `console-outreach-draft` és `console-report`
(a felső sáv a betűtípus beállása után 1–2 px-szel lejjebb), `console-dashboard` (2 px élsimítás).
A többi 34 kép pixelre egyezett.

- **Visszafordíthatóság:** 🔄 a kapu egy függvényhívás a `deploy-prod.sh`-ban; a gyártó változása
  additív.

### ADR-0220 kiegészítés (2026-09-24) — a partner-súgó képei is a kapu alatt; a betű és az óra rögzítve

**Kontextus (mérve).** ① A `partner-kb-shot.mts` a KÖZÖS dev DB-ből fényképezett: ma 12 partner
volt benne — köztük a tulaj saját cégeinek valós nevei — és 0 bizonylat. Egy friss kép tehát
személyes adatot vitt volna a súgóba, a bizonylat-kép pedig ÜRES lett volna egy 14 bizonylatot
magyarázó szöveg mellett; a három commitolt kép egy hónapja elavult volt, és semmi nem jelezte.
② A rebase után a `--determinism` 26 admin-képen jelzett szórt glifa-eltérést (600–1 700 px): az
admin a Google Fonts-ról, HÁLÓZATON tölti az Inter + Space Grotesk betűt, a kép így a CDN
függvénye volt — a kapu egy változatlan képet „elavultnak" mondott volna.

**Döntés.**
1. **Partner-képek a valódi adatrétegből, saját scratch-DB-ből:** minden futás egyedi nevű
   adatbázist hoz létre, migrál, a meglévő demo-seedet tölti bele (csak TESZT-jelölt adat), a
   vevőhöz egy demo-tenantot köt UGYANAZOKKAL a modulokkal, mint a `kb-shot` fixture-je (galéria,
   szobák, foglalás → 6 070 Ft/hó = 60 700 Ft/év, egyezik az admin súgóval), és a végén eldobja.
   Kézzel írt fixture-t NEM használunk: a KPI/korosítás/fizetési szokás SQL-ben számolódik, egy
   fixture ezeknek a szabályoknak a második példánya lenne.
2. **Rögzített óra** (`scripts/lib/frozen-clock.mjs`, `2026-09-23T10:00+02:00`) a gyártóban ÉS a
   seed gyerekfolyamatában; a DB-oldali `created_at DEFAULT now()` a scratch-DB-ben erre állítva.
   Nélküle a kép naponta változna (lejárati napok, „Partner azóta").
3. **Betű a repóból:** a képgyártók a Google Fonts kéréseit egy commitolt pillanatképből
   szolgálják ki (`scripts/lib/kb-shot-fonts/`, 296 kB, OFL-licencű betűk), MINDEN más külső kérést
   elutasítanak, és egy nem kiszolgált kérés HANGOS bukás (a hiányzó betű csendben rendszer-betűre
   cserélődne). Frissítés csak tudatosan: `npx tsx scripts/kb-shot-fonts.mts --refresh`, utána
   minden admin súgó-kép újragyártandó.
4. **Egy parancs:** a `kb-shot` a végén a partner-gyártót is futtatja, így a `--determinism` és a
   deploy GATE 1c/kép mind a 43 képet lefedi.

**Határ.** A partner-képekre nincs ÉP-ŐR (beomlás-mérés) — a pixel-kapu a commitolttal veti
össze őket, egy beomlott kép ott bukik.
