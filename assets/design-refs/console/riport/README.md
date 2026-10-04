# Riport — 1. kör: Megkeresés-tölcsér + Viselkedés (ADR-0322 — „B: kérdés-első")

Tulajdonosi jóváhagyás: 2026-10-04 („B Mehet"). A vázlat `riport-1kor.html` (A/B egy fájlban;
a **B** köt, az A elvetve), képek: `ui-riport-B-tolcser-{desktop,mobile}.png` (Tölcsér lap),
`ui-riport-viselkedes-{desktop,mobile}.png` (Viselkedés lap). **Ez a terv KÖT** — elvárt viselkedés,
nem stílus-javaslat. A számok a vázlatban pilot-alakú MINTA (168 kiküldés), nem valós adat.

**Hatókör:** `src/console/reportViews.ts` · `src/console/reportData.ts` · `src/analytics/exitReason.ts` · `assets/runtime/cit-configurator.js`

## Miért létezik

A pilot valós megkereséseket küld, és a mai `/report` egyetlen, dátum nélküli, pénz nélküli
tábla, amelynek a „Konvertált" oszlopa mindig 0 (a `prospect.status` sosem lesz `converted`).
A tulaj kérdése nem „mennyi", hanem **„miért nem vásárol, aki nem; mennyire mélyül el, aki igen;
milyen eszközről; hol lép ki"** — erre a lap a mért linkek eseményeiből válaszol, és ahol a mérés
nem elég, kérdez (mikro-kérdőív), majd a kettőt egymáshoz kalibrálja.

## Amit a terv KÖT

### Közös (mindkét lap)

1. **Szűrősor egy sorban, minden diagram fölött:** időszak-chipek (7 nap · 30 nap · 90 nap ·
   Összes) + bontás-legördülő (szegmens · csatorna · eszköz · mock-stílus · küldési óra). Minden
   szám a szűrőre számolódik; a jobb szélen a tényállás: „N követett link az időszakban · csak
   KIKÜLDÖTT linkek (saját megnyitás, teszt nem számít)" (ADR-0139).
2. **Lapok a Riport modulban:** Tölcsér · Viselkedés (1. kör) · Pénzügy (2. kör, tiltott fül) ·
   Tenantok (3. kör, tiltott fül). A nav `/report#sent` és `/report#orders` halott horgonyai
   megszűnnek (a két lap saját útvonalat kap).
3. **Tölcsér-lépcsők és definíciójuk** (a cím alatt kis betűvel, a lapon kimondva):
   Kiküldve = `prospect.sent_at` (bármely csatorna) · Megnyitva = emberi jel a lapon
   (`POST /p/:token/view`, ADR-0291) · Elmélyült = modul/preset-érintés VAGY ≥50% görgetés ·
   Rendelés = `order_intent.submitted_at` · Fizetve = `payment.status='paid'`. ⛔ A „Fizetve" a
   payment-ből számolódik, NEM a `prospect.status`-ból — és a `converted`/`lost` státusz-írás
   is megjavul (fizetéskor `converted`, leiratkozáskor `lost`).
4. **Mediánt mutatunk, nem átlagot** (p90-nel együtt): küldés→1. megnyitás, megnyitás→elmélyülés,
   megnyitás→rendelés, rendelés→fizetés, küldés→fizetés. A lap kimondja: „Mediánt nézünk, nem
   átlagot".
5. **Változás az előző, ugyanakkora időszakhoz** minden KPI-n (+/− db vagy százalékpont, zöld/piros
   SZÖVEG-tokennel, `--citui-ok-ink`/`--citui-bad-ink`); „Összes" szűrőnél nincs összevetés (—).
6. Dizájn: csak `--citui-*` tokenek; diagramszín = egy hue (link-ink / cián) + halvány szürke
   (emphasis), kategorikus szín CSAK az eszköz-panelen (3 osztály, közvetlen felirattal). Minden
   diagramhoz tartozik szám is (tábla vagy felirat) — a szín sosem egyedül hordoz jelentést.
   Világos ÉS sötét mód (ADR-0233). Mobil: `@container`, egyhasábos; asztal: kéthasábos panelek.

### Tölcsér lap (B — kérdés-első)

7. **Hat kérdés-kártya legfelül** (a mai H1–H5 folytatása, +1): „Megfogja-e a levél?" (megnyitás /
   kiküldött, cél 40%) · „Visszatér-e?" (visszatérő / megnyitó, 30%) · „Belenyúl-e a modulokba?"
   (elmélyülő / megnyitó, 20%) · „Megrendeli-e?" (rendelés / kiküldött, 4%) · „Ki is fizeti?"
   (fizetve / rendelés, 75%) · „Gyorsan reagál-e?" (medián küldés→1. megnyitás, cél ≤ 24 óra).
   Kártyánként: a kérdés, a mérőszám neve, a NAGY érték, ítélet-pill (**„cél felett"** · **„közelít"**
   · **„cél alatt"** · **„nincs adat"**), mérő a cél-jelölővel, a tört (N / M), 6 heti szikra-vonal.
   A célok a `/pricing`-hoz hasonlóan operátor-állíthatók (nem beégetett szám) — első kör: konfig.
8. **Visszatérés-panel:** 1 / 2 / 3+ látogatás → db + „rendel: X%", és az eszkalációs ajánlat
   tényállása egy mondatban (megjelent N-nek, kattintott K, rendelt R, elvetette E).
9. **Bontás-panel** a kiválasztott dimenzió szerint: ÖSSZES sor + dimenzió-sorok, oszlopok:
   Kiküldve (mini-sávval) · Megnyitva · Elmélyült · Rendelés · Fizetve.
10. **Kohorsz-tábla:** küldési hét × (Kiküldve · Megnyitás 7 n. · Rendelés 14 n. · Fizetve 30 n. ·
    1. megnyitás medián); a ráta-cellák egy-hue hő-színezéssel; a még le nem telt ablakú sor
    „nyitott" jelet visel.
11. **Pilot-napló:** kiküldés/nap (oszlop) + megnyitás/nap (vonal), tooltip-pel, és a tulaj
    JEGYZETEI függőleges jelölőként (dátum + szöveg). A jegyzet a lapon beírható („Jegyzet
    hozzáadása"), tárolódik (új tábla: `report_note`), a diagramon azonnal megjelenik.

### Viselkedés lap

12. **Hat KPI:** medián időtöltés (p90-nel) · medián görgetés · mobilról % (tablet/asztali) ·
    ár-panelig jutott % · fizetésnél elakadt (db + % a rendelésből) · kimondott ok (db, % a nem
    vásárlókból).
13. **Eszköz-panel:** Mobil / Tablet / Asztali — megnyitók száma ÉS „fizet: X%" eszközönként, alatta
    a következtető mondat (a mobil hozza a megnyitások X%-át, de a fizetésig Y% jut el…).
    ⛔ Az eszköz a `user_agent`-ből KINYERT mező (mobil/tablet/asztali + OS + böngésző), a nyers
    UA-t és a teljes referrert a `mock_view` a továbbiakban NEM tárolja (ADR-0108 egységesítés:
    referrer → host).
14. **Kilépési térkép:** a mock szekciói sorrendben (Hős · Galéria · Szobák · Szolgáltatások ·
    Vélemények · Térkép · Ár-panel · Számlázás · Fizetés) — „eljutott ide" (halvány) és „itt lépett
    ki" (telített) ugyanazon a sávon, jobbra a kilépés %-a és az elérők száma; a legforróbb sor
    piros (`--citui-bad-ink`). ⛔ Ehhez ÚJ mérés kell: szekció-láthatóság event
    (IntersectionObserver, `section_seen {id}`) és `pagehide`-nál az utolsó látott szekció +
    checkout-lépés (`dwell_end {seconds, last_section, last_step}`); a `/pay/go` megnyitása
    naplózódik (`pay_go` event a prospecthez).
15. **Miért lépett ki — két réteg, három nézet** (chipek: Következtetett · Kimondott · Egymás
    mellett). Következtetett: minden nem vásárló megnyitó EGY címkét kap a 10-ből (Nem fogta meg ·
    Nézelődött, nem lépett · Konfigurált, nem vette komolyan · Ár-sokk · Számlázási súrlódás ·
    Domain-kapu · Modul-függőség · Fizetés-elakadás · Eszkaláció elvetve · Technikai), a
    bizonyossággal („biztos jel" = konkrét eseményhez kötött, „közepes jel" = időzítésből). A
    szabályok és küszöbök EGY helyen élnek (`src/analytics/exitReason.ts`), és a lead-lapon is
    ugyanaz a címke jelenik meg („valószínű ok: …"). Kimondott: a mikro-kérdőív 5 opciója.
16. **Kalibráció-tábla:** kimondott (sor) × gépi tipp (oszlop), az egyező cella zöld, alatta a
    találati arány mondatban és a hangolási tanács. Üres állapot kimondva („Még nincs olyan
    látogatás, ahol kimondott ok is lenne…").
17. **Gyors vevő vs. mély vevő:** fizetők két csoportban (≤ 6 óra az első megnyitástól / több):
    látogatás a fizetésig · időtöltés · modul-érintés · preset-váltás · megnyitás→fizetés ·
    mobilról %. 0 vevőnél „–", nem kitalált szám.
18. **Nap × óra hőtérkép** a megnyitásokról, Budapest-idő (ADR-0288), egy hue; alatta a csúcs
    kimondva és a következtetés („a küldési ablakot ehhez igazítjuk").
19. **Mikro-kérdőív** (a lapon előnézetként, a mock-oldalon élesben): „Mi tartotta vissza? Egy
    koppintás, segít jobbat kínálnunk." — opciók: Drágának találom · Most nem időszerű · Nem bízom
    benne, vagy nem értem · Van már honlapom, nem kell · Más… (szövegmező csak a „Más"-nál);
    gombok „Elküldöm" (opció nélkül tiltott) és „Inkább nem"; köszönő mondat: a válasz csak ehhez a
    megkereséshez kapcsolódik, nevet nem kérünk. Három megjelenési pont: az eszkalációs ajánlat
    elvetése után (nem blokkoló kártya), a leiratkozó lapon a visszaigazolás UTÁN (semleges, nincs
    eladás), és az emlékeztető levél linkjéből nyíló megerősítő lapon (gomb + POST dönt, ADR-0291).
    Tárolás: `prospect_feedback` (prospect, forrás, ok, szöveg, idő). A szöveget a jog-őr nézi.

## Amit a terv NEM köt / nyitva hagy

- A sötét mód színei a megvalósításban a konzol sötét hatóköréből jönnek (a vázlat világos).
- Az ítélet-célok számai (40/30/20/4/75/24 óra) kezdőértékek — a tulaj a konfigban átírja.
- A 2. kör (Pénzügy + csomag-besorolás) és a 3. kör (Tenant-aktivitás + forgalom) külön terv.
