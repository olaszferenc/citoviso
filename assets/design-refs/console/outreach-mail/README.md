# Hideg megkereső levél — kontraktus (ADR-0101, „B: levélpapír + navy ár-kiemelés")

Tulajdonosi jóváhagyás: 2026-09-06 („B verzió a jó de az itt is lehet navy kiemelés mint a
C-n"). Az `outreach-mail-b-navy.html` a jóváhagyott, működő vázlat (méret-váltó + „mai levél"
összevetés); a `mail-markup.mts.txt` a levél TÉNYLEGES markupja; a képek a döntéskori
állapotok. **Ez a terv KÖT — elvárt viselkedés, nem stílus-javaslat.**

A vázlat valós adaton készült: Rozé Fogadó (4,7 ★ / 91 vélemény, `nincs_honlap` szegmens),
a `hero.png` a lead saját mockjának valódi nyitóképe.

## 1. Amit a SZÖVEG köt

A levél tördelt, egy-gondolat-egy-mondat. A mai egybefüggő tömbök helyett:

> ⚠️ **A SORREND MEGVÁLTOZOTT (ADR-0121, tulajdonosi döntés 2026-09-11).** Az 1–2. pont
> felcserélődött, és a megszólítás NEVET kapott. Az eredeti indok (a levél első ~90
> karaktere a Gmail előnézet-sora, és egy névtelen formula ebből ~21-et eléget) ma is áll —
> a **névvel** ellátott megszólítás viszont nem éget el semmit: pont a név az, ami az
> előnézet-sort személyessé teszi. A tulaj két kifogása („a megszólítás a nyitómondat UTÁN
> áll" + „névtelenül") így egyszerre szűnik meg, az előnézet-sor vesztesége nélkül.

1. **Megszólítás a levél ELSŐ sora, ÖNÁLLÓ bekezdésben, a lead NEVÉVEL**:
   „Tisztelt Rozé Fogadó!" — alanyeset, tehát nincs mit ragozni (az alábbi „a(z)"-tilalom
   érintetlen). Ez viseli a §C.3 személyre-szabási horgonyt.
2. **Horog**: a lead saját bizonyítéka + a hiány, két rövid mondatban — **a NÉV NÉLKÜL**,
   mert azt a megszólítás egy sorral feljebb már kimondta (megismételve körlevélnek hat).
   „A Google-on 4,7 csillagos, 91 vélemény alapján. Saját honlapot viszont nem találtunk
   hozzá."
3. **Ajánlat-mondat**, keretezéssel: „Ezért készítettünk egy honlap-tervet. Előzetes
   látványterv az Önről nyilvánosan elérhető adatokból: nem kész oldal, és semmire nem
   kötelezi." (§A demo-framing.)
4. Kép + gomb + nyers URL, majd három rövid bekezdés: kipróbálhatóság → ár → élesítés.
5. **A levél VÉGIG T/1-ben beszél** („néztük" / „készítettünk" / „élesítjük") — ADR-0121 ②.
   ⛔ Személy-váltás a levélen belül tilos: a tulaj a „néztük → készítettem → mi élesítjük"
   ugrálást kifogásolta, és a T/1 az igaz hang is (a tervet a rendszerünk állítja elő,
   nem az aláíró rajzolja).

**⛔ Nyelvi tilalmak (a „gépi szöveg" érzés forrásai, tulaj-kifogás 2026-09-06):**

- **„a(z)" SEHOL.** Ha névelő kell a lead neve elé, a `huArticle()` dönt („A Rozé Fogadó" /
  „Az Ódon Fogadó"); ahol a név ragozódna, ott a nevet KI KELL HAGYNI a mondatból (a tárgy és
  a horog úgyis viszi) — nem ragot találgatunk.
- Nincs csupa nagybetűs kiabálás (`TERVÉT`), nincs „személyre szabott", nincs három
  gondolatjeles alárendelés egy mondatban, nincs 40+ szavas körmondat.

## 2. Amit a KINÉZET köt

1. **Citoviso-arculat, minden leadnél ugyanaz** (`--citui-*`-ból másolt hexek). ⛔ A levél
   NEM veszi fel a lead mockjának skinjét — ez kimondott döntés, nem elmaradt ötlet
   (ADR-0101; a Rozé Fogadónál a skin bordó `#6e1423` + krém lenne).
2. **Vékony fejléc**: bal oldalt „CITOVISO" + ciános pont, jobbra „ELŐZETES LÁTVÁNYTERV"
   kis kapitálissal, alatta 2px ciános vonal. Két TÁBLACELLA, nem float.
3. **Hero kép** a terv nyitóképéről, kattintható, 560px-ig, mobilon folyékony.
4. **Egy elsődleges gomb** („Megnézem a tervet", navy), ALATTA a nyers URL apró szürkével —
   a nyers URL bizalmi elem hideg levélben, nem elhagyható díszítés.
5. **Navy ár-kiemelés** (`#0a1f36` doboz): ciános „BEMUTATKOZÓ AJÁNLAT" felirat, áthúzott
   listaár, nagy kedvezményes ár, `−N%`. Ez a levél egyetlen erős vizuális hangsúlya.
6. **Aláírás + szürke lábléc** vékony vonallal elválasztva.

## 3. Amit a JOG köt (változatlanul)

⚖️ **A hirdető CÉGAZONOSÍTÁSA a lábazatban (ADR-0121 ③, 2026-09-11).** Az aláírás egy
személynevet és a márkanevet mondja; hideg kereskedelmi üzenetnél ez nem azonosítás
(Grt. 6. § / Eker.tv. 4. §) — a címzettnek vissza kell tudnia keresni, kivel áll szemben.
A lábazat utolsó sora ezért **„A megkeresés küldője:”** + név · székhely · nyilvántartási
és adószám, a `config.legalEntity`-ből (EGY forrás az impresszummal, ADR-0110). Üres env →
hangos placeholder, amit a §C.2 kapu kidob; kitalálni tilos.

👁️ **Az operátor a TELJES levelet látja küldés előtt (Elek FK-004 ①).** A piszkozat-képernyő
előnézete nem vághatja le a levél alját: a jogi vég (aláírás, apróbetű, leiratkozó-link,
jogalap) épp a legfontosabb rész, és egy 560px-es keret pontosan azt takarta el.
Őr: `scripts/outreach-preview-check.mts`.

Az ADR-0088 ① érvényesség-mondata (**„A kedvezmény az első díjra szól, a hosszabbítás
listaáron megy."**) a levélben MARAD — csak a helye változott: az ár-mondat közepéről a szürke
lábjegyzetbe, a leiratkozó fölé. Az `offer-ui/README.md` 5. pontja ezzel nem sérül: a mondat
kimondva van, nem tűnt el. Ugyanígy kötelező marad a leiratkozó-link, a jogalap-sor és az
adatkezelési tájékoztató linkje (§C1/C2), és a §C-kapu (`outreachCheck.ts`) továbbra is ítél.

## 4. ⛔ OUTLOOK-BIZTOS MARKUP (néma hiba — ezért kapu, nem ajánlás)

2026-09-06-án a levél böngészőben és Gmailben hibátlan volt, **Outlookban szétesett**: a sötét
ár-doboz az egész 1900px-es ablakot átérte, a fejléc-felirat egymásba csúszott. Ok: a Word-motor
eldobja a `max-width`-et `<div>`-en és nem ismeri a `float`-ot.

A kötelező szerkezet:

- minden vázat `<table>` tart, a fő tábla **MSO-feltételes szellem-táblázatban** fix
  `width="600"` — a többi kliens a folyékony `max-width:600px` táblát kapja. (Csak fix
  szélességgel MOBILON vágódik le a szöveg; mérve 390px-en. A kettő együtt kell.)
- vízszintes elrendezés = táblacella, **nem** `float`/flex/grid;
- nincs `<style>` blokk (a Gmail kiszűri), nincs CSS-változó, nincs háttérkép;
- betű-stack valódi telepített fonttal az elején (`'Segoe UI'`, …) — az Outlook a
  `-apple-system`-en elhasal.

Az őr: `mail-markup.mts.txt` fejlécében hivatkozott `outlook-lint`. **Negatívan is le kell
futtatni** (a valódi törött markupon PIROS legyen), mielőtt zöldre hisszük.

## 5. Ellenőrzés

`npx tsx scripts/ui-shot.mts <fájl>` → 390px + asztali, és a képeket MEG IS NÉZNI. A levél
interaktív részét (méret-váltó, összevetés) Playwrighttal végigkattintani, JS-hiba = 0.

⚠️ Próba-küldésnél a gomb SOHA ne a tracked `/p/<token>` linkre menjen, hanem a követés nélküli
`/configure/<artifactId>`-ra: a tracked linken a 3. megnyitás 50%-os eszkalációs ajánlatot
mintáz (`offers.ts ESCALATION_VISIT_THRESHOLD`), és 24 óra múlva a napi billing-tick VALÓDI
levelet küld a VALÓDI szállásadónak. A leiratkozó-link próbában legyen halott példa-útvonal.
