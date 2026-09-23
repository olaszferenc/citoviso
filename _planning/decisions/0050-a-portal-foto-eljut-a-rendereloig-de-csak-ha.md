## ADR-0050 — A PORTÁL-FOTÓ: eljut a renderelőig, de csak ha tényleg a SZÁLLÁSÉ

- **Kiváltó (tulaj, 2026-08-21):** „Különböző portálokról miért nem scripeljük le a fotókat?
  Mennyi mennyiségű fotót tudnánk elérni így? Kiválogathatná a legjobbakat a honlapra."

**Amit a leltár mutatott:** a portál-réteg (f510bf8) MÁR gyűjtött fotót — adatlaponként akár 60-at
—, de a `portalProfiles`-t `src/scraper/` alatt SEMMI nem olvasta: a mock továbbra is a 6
konfidencia-kapus Places-képből épült. Ráadásul a motor-út minden képre egységes
`provenance: "places"` bélyeget ütött, így a §A élő-kapu fikcióra döntött volna. Harmadszor pedig
a mentés is hasalt: a `matched_entity` JSONB oszlopba nyers URL ment, amitől egy 554 leades futás
EGÉSZE visszagörgült (egy tranzakció). Mindhárom láthatatlan volt — a `tsc` zöld, minden
pipeline-őr zöld, és a DB-ben még nem volt portál-adat, ami cáfolja.

**Döntés**

1. **A fotó a KÖZÖS kapun át jön, jogállással együtt.** A `resolveGatedPhotos` (amit az AI- és a
   motor-út is hív) `GatedPhoto{url, provenance, caption, sourceUrl}`-t ad. Portál elöl (a tulaj
   saját, szándékosan fotózott marketing-készlete), utána a Places. Sapka: 24 portál / 6 Places
   (utóbbi fizetős hívás). A `toSitePhotos` seam képenként őrzi a jogállást — egységes bélyeg
   tilos, mert a §A élő-kapu ezen a mezőn dönt.

2. **Az A4-sáv a PLACES-egyezésről szól, nem az adatlapról.** Alacsony sávnál a Places-képek
   elmaradnak, a külön kapuzott portál-képek megmaradnak. A portál-fotók kapuja a kinyerésnél van
   (közepes sáv ⇒ `photos: []`), és a generátor ezt védekezőn megismétli.

3. **A FORRÁST nem szűkítjük — a KÉPET minősítjük.** (Tulajdonosi választás.) Az airbnb / booking /
   szallaskereso valódi galériát ad, csak még nincs a registryben (ADR-0037 promóció külön,
   lassabb sáv). Ezért nem forrás-allowlist, hanem **méret + URL-alak**:
   **800 px hosszabb él** a küszöb (hero-nak ez a reális alsó határ), plusz URL-tiltólista
   (megosztó-link, `/images/city/`, település-kép, cikk-illusztráció, zászló-ikon, térkép,
   SVG) és a szabványos hirdetés-méretek.

4. **A küszöbök MÉRVE, nem tippelve.** Az első valódi merítés (607 kép, Balaton északi part) volt
   a kalibráció: a bannerek mind 980×240 (**4,08:1**), a legszélesebb VALÓDI fotó egy medencés
   vendégház 980×360 (**2,72:1**) — ezért a szalag-arány határa **3,0**, nem 2,5. Egy 2,5-ös
   küszöb csendben elkezdett volna valódi fotókat elhagyni.

5. **A méret a fájl FEJLÉCÉBŐL jön** (Range-kérés, 64 KB; PNG/GIF/WebP/JPEG), mert a 607 képből
   csak 8-nak volt tárolt mérete, és az URL is csak 213-nál árulja el. Amit nem sikerül lemérni,
   azt MEGTARTJUK — a metaadat hiánya miatt valódi fotót veszíteni rosszabb hiba.

6. **Nem törlünk, olvasáskor ítélünk.** A visszatöltő (`backfill-portal-photo-size.mts`) csak
   méretet ír a meglévő rekordokhoz; az elutasított képek benne maradnak az adatban — ugyanaz az
   elv, mint a kontakt-főkönyvnél: egy szűrő, amit nem lehet auditálni, nem megbízható.

**Miért nem a vízjel volt az első lépés:** a §A.2 szerint a vízjel az egyetlen feltétlen kizáró ok,
de a valós merítésen kiderült, hogy a nagyobb kár a **téves tulajdonítás**: nyolc leadből kettő
hero-ja a falu TEMPLOMA (utazási cikkből) és egy általános tájkép (Booking város-stock) lett volna.
Ez §B.17-sértés — a mock azt mondja „ez a te helyed", és mást mutat. A vízjel-detektor ezután jön,
már megtisztított halmazon.

**Visszafordíthatóság:** 🔄 a küszöbök egy modulban, névvel (`MIN_LONG_EDGE`, `MAX_ASPECT`);
az adat nem vész el, tehát egy lazítás visszahozza a képeket új scrape nélkül.

**Bizonyíték:** 607 → 169 tulajdonítható kép; mindkét téves hero megszűnt (a két lead 0 portál-fotót
kap és Street View-ra esik vissza — ez az őszinte kimenet); kilenc lead hero-ja szemrevételezve,
mind valódi épület/belső/medence. Kapuk: `portal-photo-check` (bekötés + jogállás),
`persist-portal-check` (DB round-trip a valódi sémán), `photo-quality-check` (13 valós url+méret
eset). Utóbbi **mindkét irányban** mér: lazításra 3 eset pirosodik, a TÚL szigorú 2,5-ös aránynál
pedig a Lavia valódi fotója bukik el.

**Csapda, amit háromszor is elkaptunk ezen a szálon:** a saját őr hazudott. A `portal-photo-check`
első verziója átengedte az egységes jogállás-bélyeget; a `photo-rights-edit-check` `?? BASE.photos`
fallbackje zöldet mutatott, miközben a szerkesztések no-opok voltak. Minden új őrt PIROSRA kell
futtatni szándékos rontással — és ellenőrizni, hogy a rontás tényleg megtörtént.
