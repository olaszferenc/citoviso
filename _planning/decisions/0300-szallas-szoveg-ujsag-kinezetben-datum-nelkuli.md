## ADR-0300 — Szállás-szöveg újság-kinézetben, dátum nélküli program-minta, csak beszélő fotó-felirat, a tényhűség-jelvény kinyitja a listát (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (SUB „M3”, koordinátor: CIT „élesi teszt” fő session; brief:
`~/rc-briefs/javitas-elek-0930/m3-editorial-programok.md`) · **Módosítja:** ADR-0218 ② és ④ ·
**Kapcsolódó:** ADR-0027 (editorial sablon), ADR-0061 (minta-jelölés), ADR-0292 (vendég-kritikus), §B.17.
Kontraktusok: `assets/design-refs/public-site/sablon-szoveg-feliratok/`,
`assets/design-refs/public-site/programajanlo/minta/`, `assets/design-refs/console/mock-cards-fact-list/`.

**Kontextus.** Elek élesi teljes tölcsér-tesztje (2026-10-01) a kiküldött Muschel-mockon négy sablon-szintű hibát
mért, amit a vendég-kritikus (ADR-0292, az AI-szövegre) nem javít:
- **SZ-3** — az editorial sablon újság-szerepjátéka: „Szerkesztőség” mint kapcsolat-rovat, „Nyomtatva a világhálón”,
  „Képes krónika”, „No. 1/2/3”, „Foglalási szelvény”, idézőjeles főcím, amit senki nem mondott, „A HÁZ SZÁMOKBAN” egyetlen
  szám fölött, és a `::first-letter` díszbetű, ami az „A Muschel…” szöveget „AMuschel”-lé olvasztotta (képernyőolvasó,
  másolás) — minden editorial mock „A …” szóval kezdődött. A tulaj: „Hol írnám ki ilyet egy honlapra?”
- **SZ-4** — a programajánló-minta konkrét dátumú, kitalált eseményei („okt. 3. Borkóstoló est”); a „Minta-napirend.”
  bevezető (ADR-0218 „C”) ezt nem oldotta fel.
- **L-3** — a gépi „[TESZT] Muschel Panzió — 1. kép” felirat mobilon a nyitókép alsó negyedén ült, és mind a hat
  galéria-képen ismétlődött; a portál-feliratok („Suzy 3*”, „Három Huszár Köveskal Vendégház Köveskál”) sem mondanak semmit.
- **H-2** — a konzol mock-kártyáján „Tényhűség: megjelölve”, de sem a kártya, sem a „Részletek ▾” nem mondta meg, MIT.

§2b terv-kör: működő változatok a valódi Muschel (élesről olvasva) és Három Huszár mockon; a tulaj mindegyikben a javaslatot
hagyta jóvá („egyetértek”).

**Döntés.**
1. **Editorial (SZ-3 „A”): a kinézet újság, a szavak egy szállásé.** Menü/lábléc: „Szolgáltatások”, „Képek”,
   „Vélemények”, „Az oldalon”, „Elérhetőség”; „No.” szakasz-szám, „Foglalási szelvény”, „Szerkesztőség”, „Rovatok”,
   „Vezércikk”, „Nyomtatva a világhálón” nincs; a főcím idézőjel nélkül; NINCS díszbetű; a foglaló-blokk „Szabad szoba
   kérése”, a belső második „Foglalás” cím rejtve; „A ház számokban” csak két vagy több szám fölött.
   A vélemény-kártyákon NINCS az átlag csillagsora (M4 lelete, koordinátori kérés): a `Review` nem hordoz saját
   értékelést, az átlag minden kártyán úgy hatott, mintha minden vendég azt adta volna; az átlag sora EGYSZER áll, a
   vélemény-szakasz fejléce alatt, a valódi értékelés mellett (ugyanaz a minta, mint az M4 sablonjain).
   ⚠️ Az „AMIT ITT KAPSZ” AI-szöveg (a recept `features.eyebrow`-ja), nem sablon-szöveg: a vendég-kritikus (ADR-0292) fogja.
2. **Program-minta (SZ-4 „1”, felülírja ADR-0218 ②④): dátum és nap NINCS, a cím mellett „Minta” pirula**, mint minden más
   minta-szakaszon. A sorok program-TÍPUSOK „a környéken” hellyel; a bevezető azt mondja, mit hoz az éles oldal (valós
   események, dátummal és forrással, a lead településének 30 km-es körzetéből). Az ADR-0218 ① (kitöltött A blokk) és ③
   (nincs kitalált hely/távolság/forrás) érvényben marad. A runtime `shiftSampleDates()` marad: a már kiküldött mockok
   dátumos sorai a közös runtime-ot töltik be.
   Megjegyzés a premisszáról: a mockot vendég nem látja (privát link a szállástulajnak), a kockázat az volt, hogy a
   TULAJ hiszi kitalált programoknak — élesben valós adat fut, és őr tiltja, hogy minta élesre szivárogjon.
3. **Fotó-felirat (L-3 „2”): csak ha mond valamit, és sosem a képen.** Az `alt` mindig marad; látható felirat nincs a gépi
   „‹név› — N. kép” és a csak nevet/települést/típust/csillagot ismétlő forrás-felirat esetén. A maradó felirat a kép
   ALATT áll. Egy szabály egy helyen: `src/engine/photoCaption.ts`; hatókör: editorial, brutalism, artdeco, dark-luxury és
   a recept nélküli régi út két galériája (a teljes szélességű sávon látható felirat nincs, csak `aria-label`).
4. **Tényhűség-jelvény (H-2 „1”):** megjelölt kapu TÁROLT listával → a jelvény gomb a leletek SZÁMÁVAL, kattintásra a
   kártyán nyílik a lista és a teendő (javítás, vagy a küldés-felugróban „Kiküldöm mégis” — ott a megjegyzés nem
   kötelező). Tárolt lista nélkül a régi „megjelölve” marad (nincs üres lista, nincs kitalált szám). A lista TARTALMA
   (ma a MINTA-tételeket is sorolja) a szöveg-valódiság szál dolga.

**Nem ennek a döntésnek a része** (külön szál): a többi 18 sablon játék-szövege, a vélemény-kártyák átlag-csillagsora,
az archFrames vélemény-címe.

**Őrök** (mindegyik mutációval igazolva: a javítás előtti kódon piros, utána zöld).
- `scripts/template-copy-check.mts` — EGY őr a sablon-szövegre (koordinátori döntés: az M4 tételei ide olvadnak, aki később
  landol, rebase-el): renderelt editorial, 3 arculat × mock/éles, piros ikrekkel, negatív kontrollal (két szám fölött a
  „számokban” cím visszajön); a csillagsorok száma 1 és 3 véleménnyel azonos.
- `scripts/photo-caption-check.mts` — mind a 19 sablon + a primitív galériák látható szövege; Chromiumban 390 és 1280 px-en
  a felirat doboza nem fedi a fotóét; piros ikrekkel, negatív kontrollal (a beszélő felirat megmarad).
- `scripts/module-render-check.mts` — a program-minta: 10 sor, „Minta” pirula a címen, nincs dátum/nap, nincs kitalált
  forrás/távolság, a bevezető a lead települését viszi. A `native-content-check` és a `configurator-placement-check` a poi
  szekciót a SAJÁT pirulájáról kérdezi.
- `scripts/mock-card-fact-list-check.mts` — a renderelt lead-lap valódi stíluslappal, Chromiumban; `--self-test`.
