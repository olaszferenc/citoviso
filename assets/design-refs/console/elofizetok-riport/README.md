# Riport · Előfizetők fül — bevétel, előrejelzés, előfizetők

Tulajdonosi jóváhagyás: 2026-11-04 — az A változat (a koordinátoron keresztül, Fizetés-szál).
A vázlat `plan.html` (A · B · C egy fájlban, felső sávval: változat, éles / szimulált adat, mobil /
asztali). **Az A változat („Pénz felül”) KÖT**, a B és a C csak összevetésre maradt.
Képek: `terv-A-live-{asztali,mobil}.png` (éles adat 2026-11-03-án), `terv-A-sim-{asztali,mobil}.png`
(26 szállásos KITALÁLT minta, hogy látszódjon, hogyan skálázódik). **Ez a terv KÖT** — elvárt
viselkedés, nem stílus-javaslat.

**Hatókör:** `src/console/revenueReport.ts` · `src/console/revenueReportViews.ts` · `src/console/server.ts` · `src/console/reportViews.ts` · `src/console/nav.ts` · `public/assets/ui/citui-console.css` · `kb/entries/console-report-revenue/entry.hu.md`

Az útvonal `/report/revenue`; a Riport fülsorában a korábbi „Pénzügy” helyőrző helyére került; a
stílus a konzol-CSS `rv-` blokkja.

## Miért létezik

A tulaj (2026-11-03): „report oldal bővítése: semmi infó nincs a tenantokról, előfizetett tömeg / hó,
évesek, cashflow prognózis stb.... semmi”. Aznap jött az első valódi fizető vevő, és a konzolon
semmi nem látszott belőle.

## Amit a terv KÖT

1. **Fül a Riportban:** Tölcsér · Viselkedés · Mock · Próba · **Előfizetők**; a bal menüben is.
2. **Szűrősor:** előrejelzés 3 · 6 · 12 hó (az aktuális hónappal kezdve) + tesztek Kizárva (alap) /
   Beszámítva. Teszt = „[TESZT]” névelőtag vagy az Elek-park lead (ugyanaz, mint a Próba fülön).
3. **Öt szám felül:** Aktív előfizető (havi / éves · befagyott · lemondta) · MRR · ARR · Átlagos díj / hó ·
   Lemorzsolódás 3 hó. **MRR = a megújuló előfizetések KÖVETKEZŐ díja** (listaár, az éves 1/12-e),
   nem az utolsó, kedvezményes fizetés. Nincs induló létszám → „nincs adat”, nem 0 %.
4. **Várható bevétel:** havi oszlop, **biztos** (tárolt kártya, a terhelés napján érvényes, nem
   lemondott) tömör, **becsült** (díjbekérő, lejáró kártya, nincs kártya-adat, tartozás) csíkos;
   alatta havi tábla Biztos · Becsült · Domain-kiadás · Összesen + összesítő sor. Egy hónapra
   koppintva (oszlop vagy sor): „ki mennyit, mikor”, tételenként az ok. Lemondott előfizetés a
   periódus végén „megszűnik”, onnan nem terhel. A futó próbák NINCSENEK benne (konverzió nem mért),
   csak felsorolva.
5. **Az összeg az, amit a gép terhelni fog:** a már elkészült megújítási rendelés ára, különben a
   billing ugyanazon darabjai (`renewableModuleIds` + `computeMonthly/Annual` + `domainFeeForRenewal`).
   A kedvezmény csak az első fizetésre szól (billing.ts) — a lap ezt kimondja.
6. **Domain-kiadás:** a regisztrátornál mért lejáratkor (`site.domain_expires_at`), amíg megújítjuk
   (`wantAutoRenew`), a mért beszerzési áron (`domain_tld.cost_net`, HUF). A saját domainjeink nem.
7. **Tény-bevétel** (oszlop + tábla: beérkezett · számla · sikertelen terhelés · számla-hiba) és
   **Előfizetők mozgása** (új · lemondta · befagyott · megszűnt · aktív a hó végén) egymás mellett.
8. **Kedvezmény és csomagok:** az első fizetésekben adott kedvezmény, a legutóbbi díjak vs. a
   következő ciklus, csomag- és modul/díjtétel-bontás havi összegben.
9. **Előfizetők tábla:** szállás (+ település, domain) · csomag + modulszám · díj/hó (+ első,
   kedvezményes) · havi/éves + kártya/díjbekérő · következő terhelés + összeg · kártya + lejárat ·
   állapot (Rendben · Kártya lejár a terhelés előtt · Nincs kártya-adat · Lemondta — … megszűnik ·
   Sikertelen terhelés (N×) · Befagyott — nem fizetett). Felette szűrő: Mind · Figyelmet kér · Rendben,
   és rendezés: következő terhelés · díj · név. Név → lead-lap. Telefonon kártyák.
10. Csak `--citui-*` tokenek, egy szín (link-ink) + árnyalat/csíkozás; JS nélkül is működik.

## Eltérés a vázlattól (megvalósításkor, indoklással)

- **Partner-adatlap helyett lead-lap a link:** a partner-adatlap (`/partners/<id>`) a SUB-C-ben
  készül; ha élesbe ér, a link átirányítható.
- **„Nincs kártya-adat” állapot:** a vázlatban nem volt; a 0076 előtti tokennek nincs kártya-maszkja,
  ezt nem szabad „lejár”-nak mutatni (§B.17).
- A tenant-tábla szűrője (Mind · Figyelmet kér · Rendben) és rendezése (következő terhelés · díj ·
  név) a vázlatban JS volt; a megvalósításban linkek (`st`, `sort`), JS nélkül is működik.

## Amit NEM köt

- A szimulált minta számai kitaláltak.
- A sötét mód színei a konzol sötét hatóköréből jönnek.
