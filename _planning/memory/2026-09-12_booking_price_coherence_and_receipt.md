# 2026-09-12 — Három ár egy lapon, és egy mondat egy 64 000 Ft-os kérésre (Elek FK-007)

**Szál:** a tulaj FK-007 körének hat lelete. Döntés: `_planning/DECISIONS.md` **ADR-0117**.

## Amit megmértem, mielőtt bármit javítottam

Egy lapon, egy időszakra három szám állt — és mind a három ugyanabból a `unit_price`
táblából jött. A hiba nem az árazásban volt, hanem a megjelenítés három külön útján:
a kártya `priceOn(MA)`-t írt (szerver), a tábla a szezon-sorokat (szerver), a widget
`quoteFor`-t számolt (kliens). Egy `quoteStayFrom` egység-teszt mind a háromszor zöld
lett volna. **Ezért mér az új őr a RENDERELT lapon, nem a modelleken.**

A dev DB mérése: base 24 000, Főszezon `09-15`–`09-30` 32 000. Ma 09-11 → a kártya a
szezonon KÍVÜLI árat mutatta, minősítés nélkül, épp a főszezon előtti napokban.

## Javítva (mind a hat)

1. **Kártya = SÁV** (`priceSpan`/`formatSpan`): „24 000–32 000 Ft / éj". Két hibát zár
   egyszerre: a mai nap ára nem a vendég időszakára felelt, ÉS statikus pillanatképen a
   renderelés napjára fagyott.
2. **Tételes nyugta** a beadás után, a SZERVER befagyasztott ajánlatából (`summary` a
   POST-válaszban): időszak · éjszakák · létszám · egység · hivatkozás · bontás ·
   összesen · kimondott 48 óra · a cím, ahová a válasz megy.
3. **Fedés-feloldás:** 4 megerősítő lépés → 1 koppintás; natív `confirm()` ki; a záró
   gomb **sticky**; a döntés után a felület megnevezi a győztest és a vesztest.
4. **Csempe:** az élő szám a főszám, mellette „· {n} lemondva"; a panel összeadódik vele.
5. **Vendég-lemondó lapok:** szállás neve a fejlécben, hivatkozás, „Mégsem — megtartom"
   gomb a piros MELLETT (eddig az egyetlen alternatíva a „zárja be az oldalt" mondat volt).
6. **Naptár:** a múltbeli nap megtartja a színét (halványan) — eddig a fejléc olyan színt
   nevezett meg, ami sehol nem volt a rácson; a megnyitott nap kerete jelmagyarázatot kapott.

## Amit ez a nap TANÍTOTT (ezek fájnak, nem a javítások)

- ⛔⛔ **Egy parser-hiba az orákulumban pontosan úgy néz ki, mint egy termék-hiba.** Az új
  ár-őr PIROS lett egy HELYES lapon, mert a „24 000–32 000 Ft" sávból (egy pénznem-jel, két
  szám) csak a másodikat látta — és az **öntesztje ettől ROSSZ OKBÓL volt zöld**. A saját
  eset-listám buktatta le, nem a szerencse. Második iteráció: a tábla saját dátum-sávját
  („09. 15. – 09. 30. 32 000 Ft") pénznek olvasta.
- ⛔⛔ **A nulla összehasonlítás nem zöld.** Az őr első futása kiírta, hogy „✅ minden
  vizsgált oldalon EGY ár szól egy időszakról" — miközben az EGYETLEN kapott oldalt
  kihagyta (503). Azóta: ha egy oldalt sem sikerült megmérni, az hiba.
- ⛔⛔ **A közös `sites/` miatt a pillanatkép-alapú mérés VERSENYHELYZET.** Újrarendereltem
  a lapot a saját fámból, lefotóztam a helyes árat — és a fő fa szervere 06:03-kor
  visszaírta a SAJÁT (régi) kódjából. A bizonyítékom ekkor már egy nem létező állapotról
  szólt. Azóta: a re-render a mérés-ablakon BELÜL van, közvetlenül a mérés előtt.
- ⛔⛔ **Hatókör-lelet, harmadszor** (ADR-0067, ADR-0070 után): `src/server/bookingViews.ts`
  nem volt az `i18n-sources` listán. A Foglalások fül minden felirata `T()`-be csomagolva,
  minden kapu zöld — és egyetlen string sem a katalógusban. +81 string került be.

## Közös park — amit NEM én rontottam el, és amit a tulaj döntött el

Az ELEK-park a munka közben **suspended** volt: egy másik szál 23:08-kor fagyasztotta
(FK-006 dunning-létra, `subscription.current_period_end` már 2031). Emiatt a `/t/…` 503-at
adott, a `/api/foglalas` is — a ② nyugta és az ár-őr így mérhetetlen volt. A tulaj döntése
(2026-09-11): **pillanatnyi `site.status` váltás + pontos visszaállítás**, az előfizetés-sor
érintése nélkül (az időutazó tiltva volt: minden köre +1 évvel tolja a KÖZÖS fordulónapot).
A mérés `try/finally`-ben futott, a park utána `suspended`, a foglalás-seed visszatöltve.

## Módosított fájlok

- `src/tenant/prices.ts` — `priceSpan`, `formatSpan`
- `src/tenant/editor.ts` — a szoba-kártya ára sáv lett (`priceOn(MA)` helyett)
- `src/booking/requests.ts` — `BookingSummary`, `bookingRef`, hivatkozás a levelekben,
  `siteUrlFor`, `autoDeclinedIds`
- `assets/runtime/cit-runtime.js` + `assets/runtime/cit-modules.css` — a vendég nyugtája
- `src/server/bookingViews.ts` — eredmény-sáv, csempe-szemantika, év-panel, naptár-múlt,
  jelmagyarázat, egy-koppintásos fedés-választó, sticky záró gomb
- `src/server/moduleConfigViews.ts` — márkázott vendég-lemondó lapok + „Mégsem"
- `src/server/public.ts` — verdikt/lemondás redirect (`d`/`mit`/`auto`), kettéosztott
  év-számlálás
- `scripts/booking-price-coherence-check.mts` — **ÚJ** ár-koherencia őr (öntesztelt)
- `scripts/i18n-sources.mjs` — `bookingViews.ts` a hatókörbe
- `_planning/DECISIONS.md` — ADR-0117

## Nyitott

1. **Az FK-007 teljes köre nem futott le** — a park felfüggesztve volt, és a teljes
   `run-all` tiltva. A hat lelet egyenként mérve (képekkel), de a lánc egyben nem.
2. A fedés-modál 390px-en az üzenet-mezőt a hajtás alá tolja (a sticky gomb miatt);
   görgetéssel elérhető. A gomb láthatósága volt az elsődleges — ha a tulaj mást akar,
   ez egy terv-kérdés.
3. A `/foglalas/<token>/lemondom` a dev-úton a PLATFORM host alatt fut, ezért a saját
   süti-sávunk ráül egy VENDÉG-oldalra (élesben a tenant-hoston nincs). Külön szál.
4. A felület-kapu (`surface-plan-scan.mjs`) fájllistája a `bookingViews.ts`-t NEM fedi,
   pedig az is renderelt felület — ugyanaz a hatókör-osztály, mint az i18n-listánál.
