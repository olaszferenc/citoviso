# A /p lap végleges elrendezése — terv a teljes terv után, lebegő sáv, előnézeti terv-kártyák (JÓVÁHAGYOTT TERV, 2026-11-16)

A tulaj döntése (2026-11-16, a koordinátoron át, a C1/C2/D mock-körök után):
„1)B 2B) kell, az előnézeti kártyák. 3.A De le ne vedd a rendlési lehetőséget” → az egyesített mock
(D) után: **„annyi, ha a lap alján a másik tervre kattint, akkor ugorjon a lap tetejére az új
designnal”** = jóváhagyva ezzel az egy módosítással. Döntés: ADR-0453. A mock-körök jelentései:
`~/rc-briefs/tervvaltas/jelentes-{C1,C2,D}.md`.

Kattintható terv: `plan.html` (önhordó; „Mobil 390px / Asztali” váltó, „Alaphelyzet”, a fejlécben
„Mit köt ez a terv?”). A Vitalis Apartman (Eger) két éles terve a valódi /p láncon (ár-kártya, 8 kérdés,
indító lap, rendelő panel = a valódi runtime). Képek: `terv-{mobil,asztali}-*.jpg`.

**Felülír:** `../kerdes-inditas/` 1. („a hős után”), 2. (a szövegközi „Megrendelem most, próba nélkül”
link), 10. (a pirula-pár szerepe) és 11. pontját; `../plan-tabs/` §E-t (15–17., a „Tetszett?” blokk) és
§F 19-et (a rendelés a nézett tervé); `../proba-gomb/` 1., 3. és 4. pontját és `../order-pill/` 2. pontját
a hideg lead lapon (a pirula-pár ott nem jelenik meg); `../survey-bar/` 2. pontját (a sávot kerüli a
pirulák helyett). Mindegyik README-ben jelölve.

**Hatókör:** `assets/runtime/cit-configurator.js` · `assets/runtime/cit-configurator.css` · `src/generator/configurator.ts` · `src/console/server.ts`
(a runtime p-lap-vegleges blokkja, a `PlansEntry` manifest-mező, a szerver `plansForPage` / `pickedPlanNumber` /
`pickedPlanArtifact` függvényei és a `/trial`, `/request` útvonalak). Őr: `scripts/p-lap-check.mts`.

## Ami KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **A terv zavartalanul fut le.** A hideg lead lapon (`/p/<token>`, `CFG.ask`; nem `/folytatas`, nem
   saját-vásárolt) az ár-kártya és a „Kérdése van?” blokk (`#ar`, `#kerdes`) a TELJES terv UTÁN jön:
   „**A honlap-terv vége**” szaggatott vonal, utána világos Citoviso-blokk (`citoviso` szómárka + „Ez már nem
   a honlap része — a Citoviso ajánlata.”). A blokk a konfigurátor manifestje elé kerül, így a keretező
   lábléc marad a lap utolsó szava. A `#ar` / `#kerdes` / `#inditas` / `?k=<kategória>` horgonyok
   változatlanul működnek (viselkedés-üzenetek, jóváhagyott válaszok linkjei).
2. **Első képernyő: csak a terv.** A lebegő sáv akkor jön, amikor a nyitókép (a `#top`-ot tartalmazó
   legfelső blokk) alsó éle a képernyő 35 %-a fölé ért. Telefonon teljes szélességű kapszula, asztalon
   (≥ 700 px, `@container`) jobb alul, elöl a „Tetszik a terv?” felirattal.
3. **A sáv:** „**Kérdése van?**” (a `#kerdes`-re görget) · „**Megrendelem**” („havi X Ft-tól”, a legkisebb
   csomag listaára) → a rendelő panel · „**Indítsa el · N. terv**” („{n} nap ingyen”) → az indító lap.
   Próba nélkül a „Megrendelem” a fő gomb. Egytervű lapon nincs „N. terv”.
4. **A sáv félreáll:** a Citoviso-blokknál, nyitott indító lap, csomag-lap és rendelő panel alatt.
   **Nem fedi** a terv alsó Foglalás-sávját és a süti-sávot: alsó éle a legfelső alsó rögzített réteg
   (`fixedBottomTop`) és a `--citui-consent-h` fölött. A pirula-pár (`cit-cfg-launch`, `cit-cfg-trialpill`,
   dokk) ezen a lapon nem jelenik meg (`html.cit-plap`).
5. **A terv saját rögzített / tapadó sávjai** (fejléc, oldalpontok, Foglalás-sáv, a mintaadat-sáv) a
   Citoviso-blokkban félreállnak — ÁLTALÁNOSAN: a runtime a blokkba érve MÉRI a `position: fixed|sticky`
   elemeket (`data-cit-aside`), nem sablon-osztálylistából. A süti-sáv és a saját lapjaink kivételek.
6. **Ár-kártya:** fent „**Az Ön választása** · N. terv” a terv képével és „**Csere**” gombbal (a kártyákhoz
   görget; csak többtervű lapon), alatta a régi címke/ár/tények, a fő gomb „**Indítsa el**”
   („N. terv · {n} nap ingyen · kártya nélkül”), közvetlenül alatta EGYENRANGÚ, keretes
   „**Megrendelem most**” („N. terv · próba nélkül”) → a rendelő panel. ⛔ A rendelési lehetőség nem
   tűnhet el (tulaj, „3.A De le ne vedd…”).
7. **Terv-kártyák (csak ≥ 2 terv):** a terv nyitókép-képe (a gyorsítótárazott hős-kép; ha nincs, a szám),
   „N. terv”, kijelölés-jel, „Kiválasztva” jelvény; a nézett terv alatt „a lapon most ez látható”, a többi
   alatt „Megnézem”. Három helyen:
   - **a lezáró blokk elején** („Melyik terv legyen?”): a **MÁSIK tervre kattintás betölti azt a tervet
     (`/p/<slug>/<token>/v/<n>`), a lap TETEJÉTŐL** — nem helyben jelöl, nem `#ar`-ra ugrik. Ott a kijelölt
     mindig a nézett terv, **eltérés-sor nincs**. A nézett terv kártyája helyben jelöl.
   - **az indító lapon** („Melyik tervvel induljon?”) és **a rendelő panelen** („1. Melyik tervet rendeli
     meg?”): a kártya **helyben** jelöl, a lapot nem tölti újra. Ha a kijelölt eltér a nézettől, egy sor
     kimondja: „A lapon most az 1. tervet látja, de a 2. terv van kiválasztva · **Megnézem**” — a „Megnézem”
     betölti a kijelöltet, a kijelölés megmarad.
   - A kijelölés linkenként a munkamenetben él (`sessionStorage`, hiba esetén csak a lapon); amíg nincs
     kifejezett kijelölés, a nézett terv a kijelölt. A felső sáv képes gombjai (1 · 2 · 3) a nézett tervet
     váltják, a kijelölést nem.
8. **„Az ár ugyanaz”** csak akkor áll a kártyák felett, ha minden terv ugyanabban az árazási régióban
   árazódik (`PlansEntry.samePrice` — az ár modul-alapú, a sablon nem változtatja, a régió igen; §B.17).
   „**Később is cserélheti**” mindig (a tenant-admin „Kinézet” lapja, ADR-0451).
9. **A rendelő panel:** fejléc „**1. / 3 — Terv és csomag**”, a csomag-kérdés „2. Milyen legyen az
   oldala?”, alul „**Ezt rendeli meg:** N. terv · <csomag>” (a csomagváltást is követi), a tétel-blokkban
   „Terv” sor.
10. **Indítás:** az „elküldtük” állapotban „**Ezzel a tervvel indult:** N. terv”.
11. **Szerver-szerződés:** a próba (`POST /p/<t>[/v/<n>]/trial`) és a rendelés (`POST /p/<t>[/v/<n>]/request`)
    a kérés `plan` mezőjében kapott tervszámot veszi, a link SAJÁT tervkészletéhez mérve
    (`listProspectPlans` — ugyanaz, mint az ADR-0449 `/v/<n>/` útvonalaié; ott a kapu és az elutasított
    terv szabálya változatlan). Nem létező tervszám vagy nem szám → 404, semmi nem íródik. `plan`
    nélkül a cím terve (ADR-0449), a `/folytatas` a futó tervet (változatlan).
12. **A régi „Tetszett?” blokk** (`#cit-plans-end`) a konfigurátoros lapon NEM jelenik meg — beleolvadt a
    lezáró blokk kártyáiba (C2 „B”). Konfigurátor nélküli többtervű lapon (nincs árazási régió) marad.
13. **Egytervű lead:** nincs kártya-blokk, nincs „N. terv” felirat, nincs eltérés-sor; a lezáró blokk és a
    sáv ugyanúgy.
14. **i18n (§B.18):** minden felirat `tr("…")`; a magyar névelő („az 1.”, „a 2.”) csak magyar lapon.
    Fordítás CSAK Bábel.

## Mérés (mock_event, a meglévő `track()` gerincen)

| esemény | payload | mikor |
|---|---|---|
| `plan_pick` | `{plan, where}` | kártya helyben (trial / order / end) |
| `plan_view_click` | `{plan, from}` | a lezáró blokk kártyája / „Megnézem” betölt egy tervet |
| `price_open` | `{via:"bar"}` | a sáv „Kérdése van?” |
| `trial_open` / `order_open` | `{via:"bar"}` / `{from:"bar"}` | a sáv gombjai |

## Kötő feliratok (contract-drift-check)

**„A honlap-terv vége”** · **„Ez már nem a honlap része — a Citoviso ajánlata.”** · **„Melyik terv legyen?”** ·
**„Melyik tervvel induljon?”** · **„1. Melyik tervet rendeli meg?”** · **„2. Milyen legyen az oldala?”** ·
**„A lapon most {art} {n}. tervet látja, de {art2} {m}. terv van kiválasztva.”** · **„Megnézem”** ·
**„a lapon most ez látható”** · **„Kiválasztva”** · **„Az Ön választása”** · **„Csere”** · **„Megrendelem most”** ·
**„próba nélkül”** · **„Tetszik a terv?”** · **„Kérdése van?”** · **„Ezt rendeli meg:”** · **„Ezzel a tervvel indult:”** ·
**„Terv és csomag”** · **„Az ár ugyanaz, és később is cserélheti.”**

## Kötő horgony

- `id="ar"`
- `id="kerdes"`
- `cit-pend`
- `cit-pbar`
- `data-pk-pick`
- `data-cit-aside`
- `samePrice`
- `pickedPlanArtifact`

## Képek

`terv-{mobil,asztali}-01-elso-kepernyo` · `-02-terv-kozepe-sav` · `-03-lezaro-blokk-eleje` ·
`-04-lezaro-kartya-2-terv-teteje` · `-05-arkartya` · `-08-indito-lap-2-terv` · `-10-rendelo-panel` (a mock).
A megvalósítás képei: `megvalositas-{mobil,asztali}-*.jpg` (a valódi runtime a `scripts/p-lap-check.mts`
kétterves fixtúráján, a valódi konzol-láncon).
Ellenőrzés: `npx tsx scripts/p-lap-check.mts` (+ `--self-test`, `--shots <mappa>`).
