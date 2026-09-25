## ADR-0233 — A belső konzol kerete a tenant-admin „Linear” nyelvén, EGY bővíthető navigációs fából (2026-09-25)

**Dátum:** 2026-09-25 · **Státusz:** elfogadva, megvalósítva (lokálban; nem élesítve) ·
**Kapcsolódó:** ADR-0224 (a tenant-admin Linear nyelve — a mag), ADR-0021 ① (dizájn-mag),
ADR-0045 §J (súgó-horgonyok), ADR-0067 ③ (kérés-szintű nyelv-kontextus), ADR-0065/0066/0076
(terv-jóváhagyási kapu), ADR-0220 (súgó-kép frissesség) ·
**Kontraktus:** `assets/design-refs/console/linear-shell/` (README = ami köt; plan.html = a kép).

**Kiváltó.** A tulaj (2026-09-25): „Ami a tenant admin oldalon van design az legyen az alap a
saját belsős admin felületen is. Először mock.” Majd a mock után: „A) Azzal, hogy a fő section
CRM Pénzügy STB mind collapsable és ha rákatt akkor adott section dashboard jöjjön be + nyíljon
ki a tree” és „struktúrát építs! Lesz még később számos alrész meg főrész is”. Az ADR-0224 ④
kifejezetten nyitva hagyta a konzolt — ez az ADR zárja.

### ① A döntés

1. **A konzol kerete = a tenant-admin Linear nyelve** (fehér csoportos oldalsáv, útvonal-fejléc,
   egy akcent, hajszálvonal, világos/sötét). A navy fejléc, a gradiens hero, a navy ikon-négyzetes
   modul-kártyák és a „Modul megnyitása ▸” **kivezetve**. Két §2b-kör: A · „Tükör” nyert a B ·
   „Modul-sáv” ellen; a tulaj módosítása: **a modul-sor maga is lap** (a modul saját irányítópultja,
   `/hub/<id>`), és a fa alatta kinyílik; a többi modul csukva (a tenant-admin Modulok-almenüjének
   szabálya). A nyíl csak hajtogat.
2. **A navigáció EGY FA — `src/console/nav.ts` —, és minden felület ebből származik:** oldalsáv,
   útvonal, ⌘K, telefon-fiók, alsó sáv, modul-irányítópult. Csomópont = modul (`group`: id, label,
   icon, role, href, children) vagy funkció (`leaf`: id, label, short, href, match). A mélység nem
   korlátozott. **Új alrész/főrész = egy sor a fában.** A `views.ts` régi `MENU` tömbje és a
   `dashboardPage` kézzel írt modul-listája (két külön példány ugyanarról a szerkezetről) megszűnt.
3. **A számlálók nem a fában, hanem a kérésben élnek:** `navCounts.ts` egy 15 mp-ig gyorsítótárazott
   olvasással tölti a kérés-kontextusba (`i18nCtx` — ugyanaz az AsyncLocalStorage, mint a nyelv);
   a jelek render-időben, az olvasó nyelvén készülnek (`navCountsOf`, tiszta függvény, hogy az őr
   fixture-rel etethesse). Az oldalsáv, a modul-lista és a widget így ugyanazt a számot mutatja.
4. **A kezdőlap és a modul-irányítópult EGY adat-objektumból renderel** (`HubData`): egy widget
   modulonként + „Figyelmet kér” lista a régi chipek predikátumaival (a modul lapján csak a sajátjai).
5. **A ⌘K funkció-kereső** a régi „16 funkció” kereső utódja a fejlécben — a fa leveleiből épül.
6. **Világos/sötét mód a konzolon is** — a `background: var(--citui-white)` a két konzol-stíluslapban
   `--citui-panel`-re állt (világosban azonos; a fehér FELIRAT-szerep érintetlen).

7. **A széles táblák és a 232 px-es oldalsáv:** a lead-lista jóváhagyott terve (ADR-0188) a „befér
   1280-on” ígéretet a keret nélküli konzolra mérte. A keret mellett ez az ígéret **az ikonsávra
   csukott oldalsávval** áll (egy kattintás, a választás megmarad); **nyitott oldalsávval a tábla
   oldalra görgethető, a Név oszlop ragad** — ahogy telefonon ma is. A két lead-lista őr ezt méri
   (csukva: befér; nyitva: görgetéssel elérhető, nem levágott). A dátum-cella nem tördelhet.

### ② Amit NEM dönt el

A ~40 képernyő belső elrendezését (a keretet kapják, saját kört nem — ADR-0224 ⑩ mintájára); a
súgó-képek újralövését ez a szál végzi, de a többi konzol-képernyő sötét-módú finomítása
(ahol a `--citui-white` nem háttér-, hanem tinta-szerepben marad) későbbi kör.

### ③ Kapuk

`scripts/console-linear-check.mts` (pre-commit, a fa/nézetek/stíluslapok/ikonok változására;
`--self-test` 5 piros kontrollal); a meglévő `help-collapse-check` horgonya (`.con-nav
a[href="/help"]`) szándékosan megtartva; i18n (minden új felirat `T()`), design-token-lint,
kb-check + kb-shot frissesség (ADR-0220).
