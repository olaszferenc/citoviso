# KONTRAKTUS — a sablonok szövege egy valódi szállás honlapjáé (18 sablon + közös minta)

**Jóváhagyta:** a tulaj, 2026-10-02 (§2b; a koordináló session szó szerint hozta: „mind igen”) — (1) §2b-kivétel a két
hibajavításra, (2) mind a 19 sablon-szöveg csere, (3) a 2b kör mindhárom tétele ·
**Terv:** `plan.html` (önhordó; a jóváhagyott csere-tábla, „Mobil 390px / Asztali” váltóval) ·
**Képek:** `organic-{mobil,asztali}.png`, `watercolor-{mobil,asztali}.png`, `dopamine-{mobil,asztali}.png`, `brutalism-{mobil,asztali}.png` (a jóváhagyott állapot, Három Huszár Apartments valódi mock-adatával; a brutalism vélemény-képe 3 jelölt teszt-véleménnyel)
**Hatókör:** `src/engine/templates/scrapbook.ts` · `src/engine/templates/organic.ts` · `src/engine/templates/watercolor.ts` · `src/engine/templates/horizontal.ts` · `src/engine/templates/cinematic.ts` · `src/engine/templates/claymorphism.ts` · `src/engine/templates/brutalism.ts` · `src/engine/templates/dopamine.ts` · `src/engine/templates/artdeco.ts` · `src/engine/templates/darkLuxury.ts` · `src/engine/templates/aurora.ts` · `src/engine/templates/archFrames.ts` · `src/engine/templates/tiltedGallery.ts` · `src/engine/templates/parallax.ts` · `src/engine/templates/wordmarkGrow.ts` · `src/engine/primitives.ts`

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kódot ehhez mérjük; őr: `scripts/template-copy-check.mts`.

## Miért

Elek élesi jelentése (2026-10-01) → az M3 szál átnézte mind a 19 sablont → a tulaj mércéje: „Hol írnám ki ilyet egy
honlapra? Nincs normális ember, aki ilyet kiír.” A sablonok a referencia-tervek „játékát” hordták („A kamra”,
„Vendégkönyv” Google-véleményekre, „Egy nap nálunk” számozott napirendként egy szolgáltatás-listára, „1. fejezet” a
szobákon, „Wellness” bármilyen listára, „>> Foglalási konzol //”, „A porta”), és öt sablon az ÁTLAG csillagsorát
minden vélemény-kártyára kirajzolta. Az editorial az M3 szál kontraktusa.

## KÖT

1. **A kinézet nem változik** — elrendezés, betűk, színek, díszítés marad; csak a szavak és az ál-jelölések mennek.
2. **Vélemény-kártyán nincs csillagsor.** Egy vélemény nem hordoz saját csillagot; az átlag sora a szakasz fejlécében
   áll, EGYSZER (brutalism: a pontszám-bélyegen). Az arch-frames vélemény-szakasza a SAJÁT címét viseli, nem a galériáét.
3. **Menü és szakasz-címek a szállás nyelvén:** a szolgáltatások neve „Szolgáltatások”, a vélemények „Vélemények”, a
   képek „Képek”, a GYIK „Gyakori kérdések”, a kapcsolat **„Írjon nekünk”**; szakasz-címek: **„Amit nálunk talál”**,
   **„Amit még kínálunk”**, **„Vendégeink írták”**; foglaló-gomb **„Szabad időpontot kérek”**.
4. **Nincs ál-jelölés:** nincs sorszám („01 /”, „01–04”, „1. fejezet”), római szám, mindig teli mérő-sáv, pont a név
   vagy a főcím végén, és a dopamine nyitó-matricája a szolgáltatás SAJÁT ikonját viseli (nem tűt — az helyszínt jelent).
5. **A galéria címe egyszer látszik** (wordmark-grow: a kiemelt mondat-sáv viszi, a galéria-fejléc „Képek”; parallax: ha
   a fotó-sáv a galéria címére esik vissza, a galéria-fejléc a sablon tartaléka).
6. **A minta-szöveg is magáz** (ADR-0292): **„a saját házirendje szerint”**, a kisállat-minta magázó alakban, a
   kompozíciós tartalék-felcím **„Így talál ide”**.

## A jóváhagyott cserék (sablononként)

| sablon | volt | lett |
|---|---|---|
| scrapbook | A kamra · a kamra polcáról · Ami nálunk jár · Vendégkönyv · a vendégkönyvből · Ide írtak nekünk · Lapozó · felragasztott cetlik · lapozzon bele · Ezt kérjük · kézírásos „otthon / nálunk” | Szolgáltatások · Amit nálunk talál · Vélemények · Vendégeink írták · Oldal · Tudnivalók · Képek · Kiválasztom · (a kézírás elmarad) |
| organic | A birtok élete · Egy nap nálunk · „Semmi sem kötelező — de minden kipróbálható.” · Ami jár · A kényelem itt sem hiányzik · Évszakról évszakra | Szolgáltatások · Amit nálunk talál · (elmarad) · Szolgáltatások · Amit még kínálunk · Képek |
| watercolor | Egy nap nálunk · Így telik majd + 01–04 · Képek a nyárból · Ami jár · Nálunk | Szolgáltatások · Amit nálunk talál (számok nélkül) · Képek · Szolgáltatások · Oldal |
| horizontal | „{n}. fejezet” · Képek a magasból | (elmarad) · Képek |
| cinematic | Minden ablak egy mozivászon · Több, mint egy szoba | Képek · Amit nálunk talál |
| claymorphism | Wellness · Puha landolás minden este | Szolgáltatások · Szobáink / A szállás |
| brutalism | >> Foglalási konzol // … · „01 /” · 01–04 · A fal · Mi van bent? · pont a főcím végén | Foglalás · (számok nélkül) · Képek · Képek · (pont nélkül) |
| dopamine | tű-ikon a szolgáltatás-matricán · Foglalnék! | a szolgáltatás ikonja · Foglalás (menü) / Szabad időpontot kérek (gombok) |
| artdeco | A porta · A ház szolgálata · A ház arcai · Kérdések a portához · Üzenet a portának | Foglalás · Szolgáltatások · Képek · Gyakori kérdések · Írjon nekünk |
| dark-luxury | I., II. … · 01–04 a képeken | (elmarad) |
| aurora | mindig 100%-os sáv · pont a név után | (elmarad) |
| arch-frames | Képek a portáról · a vélemény-cím = galéria-cím | a galéria saját címe / „Képek” · a vélemények saját címe |
| tilted-gallery | Ami csak itt van | Szolgáltatások |
| wordmark-grow · parallax | a galéria címe kétszer | egyszer (lásd KÖT 5) |
| közös minta | „…a saját házirended szerint” · „kisállat-politikád — hogy fogadtok-e” · „Ide gyere” | magázó alak · „Így talál ide” |

A fotó-feliratok és a díszbetű szabálya az M3 szál kontraktusa; ez a kontraktus nem érinti.
