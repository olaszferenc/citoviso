# 2026-08-21 — Portál-fotók: a bekötéstől a TULAJDONÍTÁSIG (ADR-0050)

## A szál íve

Egyetlen tulaj-kérdésből indult: *„Különböző portálokról miért nem scripeljük le a fotókat?
Mennyi mennyiségű fotót tudnánk elérni így? Kiválogathatná a legjobbakat a honlapra."*

A válasz első fele meglepő volt: **már scrape-eltük** (adatlaponként akár 60 képet), csak
soha nem használtuk. A második fele kellemetlenebb: amint használni kezdtük, **szemét került
az oldalra**, és a mock a falu templomát mutatta volna a tulaj kempingje helyett.

## ① A bekötés — és a három láthatatlan hiba alatta

A portál-réteg (f510bf8) gyűjtött, de a `portalProfiles`-t **`src/scraper/`-en kívül SEMMI nem
olvasta**. A mock a 6 Places-képből épült, miközben 120 potenciális kép ült a lead mellett.

Alatta még két hiba, mind a három ugyanazzal a tulajdonsággal: **zöld `tsc`, zöld pipeline-őrök**.

1. **Egységes jogállás-bélyeg.** A motor-út minden képre `provenance: "places"`-t ütött. A §A
   élő-kapu ezen a mezőn dönt → fikcióra döntött volna. Külön seam-be emelve (`toSitePhotos`),
   mert egy blanket literál tökéletesen fordul — csak teszt fogja meg.
2. **⛔ A mentés visszagörgetett EGY TELJES FUTÁST.** A `lead_provenance.matched_entity` JSONB
   oszlop, a driver szerializált JSON-t vár; a portál-ág **nyers URL-t** adott át → `22P02`
   („Token \"https\" is invalid"). Mivel egy scrape **egy tranzakcióban** mentődik, ez nem egy
   sort bukott: **mind az 554 lead** visszagörgült, órányi crawl és egy kifizetett Places-passz.
   A `tsc` néma maradt, mert a lokális sor-típus `string | null`-nak mondta az oszlopot — az URL
   az is. **Ez magyarázza, miért nem volt SOHA portál-adat a DB-ben:** az első futás, amely
   adatlapot talált, mindig itt halt meg.
   → **A crawl mégsem veszett el:** a JSON-dump a mentés ELŐTT íródik, így `seed-from-json`-nal
   visszajátszható volt. Nulla további API-költség. Érdemes tudni: a `leads-<régió>.json` a
   drága munka biztonsági mentése.
3. **A vízjel-jelölés eltűnt a tulaj első kattintására.** A sorrend/képaláírás/egység-hozzárendelés
   mindegyike kézzel írt `{url, alt, ...provenance}` literállal másolta a fotó-tömböt; mind a három
   emlékezett a provenance-ra és **mind a három elfelejtette a `watermarked`-et** (a `PhotoEdit`
   típusnak mezője sem volt rá). Az override-ok rendereléskor teljesen lecserélik a tömböt → az
   első átrendezés után a §A.2 jelölés sehol nem létezett. **Látens hiba, ami a KÖVETKEZŐ
   szeletre várt:** a vízjel-detektor egy olyan rendszerbe érkezett volna, amely a saját jelölését
   eldobja. Fix: `carryPhoto()` — egy helyen visz át minden jogállás-mezőt.

## ② A valódi baj: a kinyert képek fele nem a szállásé

Az első éles merítés (Balaton északi part, 554 lead, 607 portál-fotó) megmutatta, hogy egy
adatlap sokkal több `<img>`-et hordoz, mint a galéria. **Nyolc leadből kettő téves hero-t
kapott volna:**

- **Köveskáli Diákkemping** → egy falusi **TEMPLOM** (utazási cikkből, 350×262)
- **Landhaus Dörgicse** → általános tájkép (Booking `/images/city/` = régió-stock)

Ez **§B.17-sértés, nem szépséghiba**: a mock azt mondja „ez a te helyed", és mást mutat.
Mellettük: nyelvváltó zászló-ikon (32×22), hirdetési bannerek (`AP_300_250`), Pinterest
megosztó-linkek (nem is képek), térkép-grafikák, 150×150 bélyegképek, értékelés-csillag (108×19).

**Tulajdonosi döntés:** a FORRÁST nem szűkítjük (az airbnb/booking/szallaskereso valódi galériát
ad, csak nincs még a registryben) — **méret + URL-alak** szerint szűrünk, 800px hosszabb éllel.

## ③ A küszöbök MÉRVE, nem tippelve

- A bannerek mind **980×240 (4,08:1)**; a legszélesebb **VALÓDI** fotó egy medencés vendégház
  **980×360 (2,72:1)**. Ezért a szalag-arány határa **3,0** — egy 2,5-ös küszöb csendben
  elkezdett volna valódi fotókat elhagyni.
- A méret a fájl **FEJLÉCÉBŐL** jön (Range-kérés, 64 KB; PNG/GIF/WebP/JPEG), mert a 607 képből
  csak **8**-nak volt tárolt mérete, és az URL is csak 213-nál árulja el.
- Amit nem sikerül lemérni, azt **MEGTARTJUK** — metaadat hiánya miatt valódi fotót veszíteni
  rosszabb hiba.
- **Nem törlünk, olvasáskor ítélünk.** A visszatöltő csak méretet ír; az elutasított kép benne
  marad az adatban (ugyanaz az elv, mint a kontakt-főkönyvnél: auditálhatatlan szűrő = megbízhatatlan).

**Eredmény: 607 → 169 tulajdonítható kép.** Mindkét téves hero megszűnt — az a két lead inkább
**0 portál-fotót** kap és Street View-ra esik vissza; ez az őszinte kimenet. Kilenc lead hero-ját
szemrevételeztem: mind valódi épület/belső/medence.

Maradék: két nagy felbontású tájfotó **túraútvonal-katalógusokból** (outdooractive, termeszetjaro)
— a méret-szabály definíció szerint nem fogja meg. Ezek az oldalak legitim módon korroborálják,
hogy a hely létezik, ezért az adatlapot nem dobjuk el, **csak a képeit nem tulajdonítjuk**.
Hostnév-lista = átmeneti; a forrás TÍPUSA a platform-registry osztályozásába tartozik (ADR-0037).

## ④ Amit a vízjel-detektorról megtudtunk: MÉG NEM KELL

A listán ez volt a következő szelet. 24 valós képet néztem végig a megtisztított halmazból:
**egyetlen vízjel sincs köztük.** A detektor ma nem létező problémát oldana meg, képenként egy
vision-hívás áráért. **Nem építettük meg** — a §A.2 attól még érvényes, és a jelölés útja immár
készen áll (hordozható, túléli a szerkesztést, az élő kapu kizár rá). Amikor a valós adatban
felbukkan vízjel, a detektor beköthető.

## ⭐ MÓDSZERTAN — ezen a szálon HÁROMSZOR hazudott zöldet a saját őröm

1. A `portal-photo-check` első verziója **átengedte** az egységes jogállás-bélyeget (a mérés nem
   ért el a `generateEngine` mappingjéig) → seam-be emeltem, hogy mérhető legyen.
2. A `photo-rights-edit-check` `?? BASE.photos` **fallbackje** zöldet mutatott, miközben a
   szerkesztések **no-opok** voltak (a fixture site-járól hiányzott a `source_artifact_id`).
   A fallback kivezetve: ha nincs override, most **hibát dob**, nem sikert jelent.
3. Ugyanez az őr **szemetet hagyott** a repó gyökerében (`_pr_check.html`), amit a következő
   futtató véletlenül becommitolt volna.

**Ebből a szabály:** minden új őrt PIROSRA kell futtatni szándékos rontással — **és ellenőrizni,
hogy a rontás tényleg megtörtént**. A `photo-quality-check` ezért **mindkét irányban** mér:
lazításra 3 eset pirosodik, a TÚL szigorú 2,5-ös aránynál pedig a Lavia valódi fotója bukik el.

## ⚠️ Saját hibám, amit érdemes megjegyezni

Kétszer is **csonkolt URL-t** ellenőriztem (a saját konzol-kiírásom vágta le `.slice(0,105)`-tel),
és ebből előbb „404 — halott URL", majd „401 — mérhetetlen kép" következtetést vontam le.
**Mindkettő téves volt**; a teljes URL-lel minden működött. Ha egy URL-lel dolgozol, a
diagnosztikai kiírás rövidítése ne kerüljön be a bizonyítékok közé.

## Módosított/létrehozott fájlok

- `src/generator/generate.ts` — `GatedPhoto`, `collectPortalPhotos`, dedup, sapkák (24/6), `heroType`
- `src/generator/generateEngine.ts`, `src/engine/siteData.ts` — `toSitePhotos` (jogállás-megőrző seam)
- `src/generator/images.ts` — `toImageBlocks` (base64 vision-grounding; a portálok Cloudflare-je
  blokkolja az Anthropic letöltőjét → enélkül a brief és a copywriter némán generikusra esett)
- `src/generator/brief.ts`, `src/generator/copy.ts`, `src/engine/copywriter.ts` — vision-hívások
- `src/scraper/persist.ts` — `matched_entity` szerkezetes + `JSON.stringify`
- `src/scraper/sources/portals/photoQuality.ts` — **új** (ítélet + fejléc-mérés)
- `src/scraper/sources/portalListing.ts` — kinyeréskor szűr és mér
- `src/tenant/editor.ts` — `PhotoEdit.watermarked` + `carryPhoto()`
- `src/console/server.ts`, `src/console/views.ts` — az operátor látja a fotó forrását
- Kapuk: `portal-photo-check`, `persist-portal-check`, `photo-quality-check`,
  `photo-rights-edit-check`, `backfill-portal-photo-size` (egyszeri)

Commitok: `d64e57a` · `7cc6edf` · `5160920` · `ee142f6` · `c797f51` · `73496ef` (ADR) · `cccf65a`.
