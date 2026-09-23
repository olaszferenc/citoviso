## ADR-0115 — MOZGÁS-RÉTEG: a görgetés-vezérelt animáció DEKLARATÍV, és sosem rejthet el tartalmat (2026-09-09)

**Státusz:** ELFOGADVA (tulaj, 2026-09-08/09) · **Kód:** ÉL lokálban · **Élesítve:** NINCS (§0.3)

**Kontextus.** A tulaj három referencia-oldalt hozott minőség-mércének
(lasalaplazahotel.com, palazzosogni.com, thebendclub.com), és kimondta: „ami fontos és nálunk
konkrétan sehol nincs: ANIMÁLÁS". Mérve igaza volt: a korábbi 16 sablonból hétnek volt
EGYETLEN dísz-`@keyframes`-e, görgetés-vezérelt felfedés pedig SEHOL — az egyetlen
`IntersectionObserver` (parallax.ts) pont-navigációt hajtott, nem animációt. A referenciák
észlelt minőségének jelentős része a mozgásból jön, nem az elrendezésből.

**Döntés ① — a mozgás DEKLARATÍV, nem kód.** A markup horgot visel
(`data-cit-motion="up|rise|in|side|arch"`, `data-cit-motion-delay`), egy ~40 soros közös motor
hajtja (`src/engine/motion.ts`). A sablon-szerző `${mo("up", 120)}`-t ír; observerről,
időzítésről, teljesítményről nem kell tudnia. **Ettől generátor-barát: a horog ADAT.** Külső
könyvtár nincs (a referenciák GSAP-ot, Locomotive-ot, Lenis-t, Three.js-t húznak be).

**Döntés ② — az INTRO NEM közös vagyon.** A „névből növő kép" (a névfeliratba ágyazott kis
képkocka fotókat vált, majd kinő hero-vá) a thebendclub kézjegye, ezért CSAK a `wordmark-grow`
sablon viszi. ⛔ Ezt először elrontottam: mind a három új sablonba beletettem, ráadásul
mindhárom ugyanazt a sötétített fullbleed herót kapta — a tulaj így egyetlen dizájnnak látta a
hármat. **A közös réteg a reveal/parallax; a nyitány a formanyelvé.**
Sebesség: **0,6×** (a tulaj választása 1 / 0,8 / 0,6 / 0,4 összevetése után, ~5,8 mp), és CSAK a
session ELSŐ nézetén fut (`sessionStorage`).

**Döntés ③ — TÍZ FAIL-SAFE SZABÁLY.** Mind valódi, mért hibából született; a `motion.ts`
fejlécében mindegyik mellett ott az indok:

1. a rejtő CSS csak `html.cit-motion` alatt él, amit a JS ad hozzá → **JS nélkül semmi nem tűnik
   el**. ⚠️ A referencia-oldal ezt elrontja: `prefers-reduced-motion` alatt 23 mért elemből 16
   VÉGLEG láthatatlan marad;
2. `prefers-reduced-motion: reduce` → minden látszik, átmenet nélkül;
3. mozgás-horog SOHA nem ülhet saját transzformmal bíró elemen — a reveal `transform:none`-ja
   némán letörli a dizájn `rotate()`-jét (a döntött fotó-sor elveszett tőle);
4. a figyelt elemnek nem lehet NULLA festett doboza: `clip-path:inset(100%)` összelapítja, és a
   Chromium IntersectionObserver-e örökre `isIntersecting:false`-t ad — **a rejtés blokkolja a
   saját felfedését** (mérve: teljesen a nézetben, `ratio: 0`);
5. `[hidden]` mellé SOHA `display` szabály: a `[hidden]` nulla specificitású UA-szabály, bármely
   `display` legyőzi (a preloader krém takarója így ült végig a hero előtt);
6. átmenet előtt kényszerített reflow (`offsetWidth`), különben a böngésző egy képkockába vonja
   a kezdő- és végállapotot, és **nem fut animáció** (mérve: egyik átmenet sem futott, közben
   a maszkos „söprés" HAMIS ZÖLDET adott, mert az őr a maszk LÉTÉT mérte, nem a mozgását);
7. teljes képernyős `filter: blur()` helyett 40px-es iker felnagyítva: azonos látvány, mérve
   44 → 60 fps (67 ms-os akadások eltűntek). A kicsinyített iker amúgy is kell (LQIP);
8. FLIP-számolás: az abszolút pozicionálás a PADDING-boxhoz igazodik, a `getBoundingClientRect()`
   border-box koordinátát ad — a keret szélességét le kell vonni;
9. képkészítő eszköz állítsa a `data-cit-no-motion` (és `data-cit-no-intro`) jelet: a fullPage
   felvétel görgetés ELŐTT készül, ott a felfedésre váró elem rejtve fotózódik (az előnézeti
   lightbox üres képkereteket mutatott);
10. ugyanott a `loading="lazy"` képeket is ki kell venni, különben a hajtás alatti fotók
    üresen maradnak a felvételen.

**Döntés ④ — a sablonok KÜLÖNBÖZZENEK, és ezt PIXELBEN mérjük.** A tulaj három mockot generált
egy leadre és „kurvára ugyanaznak" látta őket, miközben a fájlok 112 kB-tal különböztek: a
bájt-diff itt semmit nem bizonyít. Mérve a gyökér-ok: **a lap 69–84%-át a KÖZÖS modul-szekciók
adják**. Tulajdonosi döntés: a modulok markupja közös marad (ADR-0047: egy modul = egy
viselkedés), de a **RÁCS, a szedéstükör és a ritmus a sablonè** — 2 hasáb / 1 keskeny oszlop /
3 hasáb, más szedéstükörrel és kártya-nyelvvel.

**Kapu:** `scripts/template-diversity-check.mts` (pre-commit) — ugyanazt a leadet rendereli
mindhárom sablonnal, laponként három képernyőt fotóz, és aláírásokat hasonlít.
⛔ **Az első változata VAK VOLT:** 24×16-os szürkeárnyalatos bélyeg — három világos lapon sötét
szöveggel majdnem érzéketlen, az elrendezés láthatóan megváltozott, a szám mégis 90,8%-ról
90,6%-ra mozdult. A különbség abban van, HOL vannak az élek, nem az átlagos világosságban.
64×40-es normalizált aláírásra cserélve, **ÖNKONTROLLAL**: ugyanaz a sablon önmagával 100%-ot
kell adjon, különben a mérőszám vak, és alatta minden szám értelmetlen. Küszöb 85%
(két valóban különböző terv 66–77%-on mér).

**Következmény.** A három új sablon (`tilted-gallery`, `arch-frames`, `wordmark-grow`) a
választható mock-típusok közt él; a mozgás-réteg a régi 16 sablont NEM érinti (opt-in).

**Nyitva:** ① az intro hossza ÉLESBEN — 0,6× ≈ 5,8 mp, ami hideg megkeresésnél sok lehet
(outreach-mockon rövidebb / élő oldalon teljes: tulaj-döntésre vár); ② a mozgás-réteg
kiterjesztése a régi sablonokra; ③ a `Döntött ↔ Névből növő` pár 77%-on mér — ha a tulaj
szemének ez még sok, a szedéstükör és a szekció-sorrend a következő fogás.
