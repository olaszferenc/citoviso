# Citoviso — DESIGN BRIEF külső tervezőnek / külső AI-nak

> **Használat:** ezt a fájlt egyben bemásolod egy AI-nak (Claude / ChatGPT / Gemini / v0 / Lovable),
> vagy elküldöd egy embernek. Mellé küldd: `docs/design-brief-sample-data.json`.
> A dokumentum önhordó — nem kell hozzá a kódbázis.
>
> Angol változat: `docs/design-brief-external.en.md`

---

## 0. A FELADAT EGY MONDATBAN

Tervezz **egy új, teljes vendég-oldal ARCULATOT (template-et)** — egyetlen, önhordó
`.html` fájlban, a mellékelt minta-adattal feltöltve —, ami vizuálisan **markánsan
különbözik** a 16 meglévő irányunktól, és közben **betartja az alábbi műszaki kontraktust**,
hogy a motorunk gépiesen tudja gyártani belőle több ezer szálláshely oldalát.

Nem képet kérünk. **Működő, megnyitható HTML-t** kérünk.

**A vizuális szabadságod teljes** — paletta, betűk, textúra, gradiens, animáció, formanyelv
mind a tiéd. A §4 kontraktus nem a designt köti meg, hanem azt, hogy a designod **átszínezhető
és adatból tölthető** legyen. Ha úgy érzed, hogy korlátoz, olvasd el a §4.1-et még egyszer —
és ha tényleg korlátoz, azt írd meg nekünk (§3/3. pont).

---

## 1. MI EZ A CÉG

A Citoviso egy **weboldal-generáló és disztribúciós gép**. Iparág-agnosztikus, de az első
pilot-vertikuma a **szálláshely / vendéglátás**.

Amit csinál:

1. **Adatgyűjtés.** Nyilvános forrásokból (Google Maps, szálláskereső portálok) összeszedjük
   egy digitálisan gyenge szereplő adatait: nevét, címét, fotóit, szolgáltatásait, leírását,
   értékeléseit.
2. **Generálás.** A motor ebből **automatikusan** legyárt egy modern, reszponzív,
   konverzió-fókuszú weboldalt. Egyetlen adat-objektum + egy template = kész oldal.
   Nincs kézi tervezés szállásonként.
3. **Hideg megkeresés.** A szállás tulajdonosának elküldjük a kész oldalt (e-mailben vagy
   MMS-ben a képével). **Ő nem kérte. Nem ismer minket.**
4. **Konverzió.** Ha tetszik neki, fizet, és az oldal élesedik a saját domainjén; utána
   moduláris felárakat vehet (foglaló-naptár, többnyelvűség, saját domain stb.).

### Miért számít ez a design szempontjából — ez a brief lelke

**A generált oldal MAGA az értékesítési ajánlat.** Nincs értékesítő, nincs prezentáció,
nincs második esély. A tulajdonos megnyitja a linket a telefonján, és **3 másodperc alatt
eldönti**, hogy ez ránézésre jobb-e, mint amije most van (általában semmi, vagy egy 2009-es
Joomla-oldal).

Ebből három nem-alkudható következmény jön:

- **A hero (első képernyő) az egész üzlet.** Ha ott nincs „wow", nincs második scroll.
- **Mobil-first, de nem mobil-only.** A tulaj telefonon nézi. A *vendége* viszont gyakran
  gépen foglal. **Mindkét méret külön tervezői döntés** — nem ugyanaz az elrendezés lelőve.
- **A saját nevét és a saját házát kell meglátnia.** Egy „szép, de bármelyik szállásé lehetne"
  sablon megbukik. Az oldal legyen **ez a ház**, ne „egy ház".

---

## 2. KI NÉZI AZ OLDALT

| Közönség | Mikor | Mit keres |
|---|---|---|
| **A szállás tulajdonosa** (hideg lead) | elsőként, telefonon, gyanakodva | „Ez tényleg az én házam? Ez jobb, mint amim van? Ez profi?" |
| **A leendő vendég** | az élesítés után, gépen és telefonon | „Milyen a hely, mennyibe kerül, szabad-e, hogyan érdeklődöm?" |

Tervezéskor **a tulajnak adsz el, a vendégnek szolgálsz ki.** A kettő nem ellentmondás:
a tulajt az győzi meg, ha látja, hogy ez a lap a *vendégét* meggyőzné.

---

## 3. AMIT KONKRÉTAN KÉRÜNK

**Egy darab önhordó HTML fájl**, ami:

- egyetlen `.html`, build-lépés nélkül megnyitható (`<style>` a `<head>`-ben, a JS `<script>`-ben inline),
- a mellékelt `design-brief-sample-data.json` **dús** adatcsomagjával van feltöltve,
- **és külön mentve ugyanaz az arculat az „adathiányos" (`_starvedVariant`) csomaggal is** —
  lásd §7.4. Két fájl: `<nev>-rich.html`, `<nev>-starved.html`.
- Google Fonts betöltés megengedett (`<link>`), egyéb külső függőség nem.
- Kép: a JSON `url` mezőiből (placeholder-szolgáltatás), ne rakj be sajátot.

Plusz **fél oldal szöveg** (`README.md` vagy a HTML tetején komment), három ponttal:

1. mi a formanyelv lényege, és mi az az **egy** dolog, amitől ez nem hasonlít a többire;
2. milyen szálláshely-karakterhez való (pl. „városi butikhotel", „vízparti apartman", „hegyi vendégház");
3. **mit nem tudtál kifejezni** a 11 design-szerep alatt (lásd §4.1 vége) — ha volt ilyen.
   Ez nem panasz-rovat: ebből bővítjük a rendszert.

---

## 4. MŰSZAKI KONTRAKTUS (ez kényszerít, nem javaslat)

A motor a te HTML-edet fogja **sablonná** alakítani, ezért gépiesen ellenőrizhető
dolgokat várunk el. Ha ezek nincsenek meg, a terv nem építhető be.

### 4.1 Design-tokenek — 11 SZEREP-NÉV, nem 11 megkötés

> ⚠️ **Olvasd el ezt a szakaszt figyelmesen, mert ránézésre korlátozásnak tűnik, és nem az.**
> A palettádat, a betűidet, a formanyelvedet **te találod ki, teljesen szabadon.** Csak
> egyetlen dolgot kérünk: a `:root`-ban **nevezd meg** őket az alábbi 11 szerep-néven.

```css
:root {
  /* A TE palettád. Ezek SZEREPEK, nem előírt értékek — írj be bármit. */
  --cit-accent:        /* akció/kiemelés szín */
  --cit-on-accent:     /* olvasható szöveg az akcenten */
  --cit-ink:           /* elsődleges szövegszín */
  --cit-muted:         /* másodlagos szöveg, képaláírás */
  --cit-bg:            /* oldal-háttér */
  --cit-surface:       /* kártya/panel háttér */
  --cit-line:          /* vonal, keret, elválasztó */
  --cit-radius:        /* sarok-lekerekítés alapegység */
  --cit-font-display:  /* címsor betűcsalád */
  --cit-font-body:     /* kenyérszöveg betűcsalád */
  --cit-shadow:        /* emelés/árnyék */
}
```

**Miért kell ez — és miért NEM ez uniformizál:**

Az `--cit-accent`-et futásidőben **a szállás saját fotóiból mintázzuk ki**, és 19 kész
paletta („skin") is rá tud ülni ugyanarra a sablonra. Ez az egyetlen oka, hogy a vízparti
villa oldala nem ugyanolyan színű, mint a hegyi vendégházé. Ha viszont beégeted a hexet a
CSS-be, akkor **több ezer szállás oldala a te színeiddel megy ki, egyformán** — az a
garantáltan gépies kimenet, nem a token.

#### Amit ez KIFEJEZETTEN MEGENGED

A 11 token a paletta. **A karakter a te CSS-ed.** Ezek mind szabadok, sőt kérjük őket:

- **gradiens, textúra, zaj, papírszemcse, `mix-blend-mode`, SVG-háttérminta, maszk, `filter`**
- **animáció, `@keyframes`, parallax, Ken-Burns, hover-mikrointerakció**
- **saját CSS-változók** tetszőleges számban (pl. `--paper`, `--glow`, `--stripe`)
- **egyedi formák**: ferde szekció-vágás, ív, blob, keret-ornamens, elforgatott elem
- **fotó-kezelés**: duotone, sepia, szemcse, kivágás, maszkolt forma

Egyetlen kérésünk: ahol *szín* van benne, azt lehetőleg a tokenből származtasd, hogy
átszínezhető maradjon:

```css
:root {
  --paper: color-mix(in srgb, var(--cit-bg) 92%, var(--cit-ink));
  --glow:  color-mix(in srgb, var(--cit-accent) 40%, transparent);
}
.hero::after {
  background:
    radial-gradient(60% 50% at 50% 0%, var(--glow), transparent 70%),
    url("data:image/svg+xml,<svg …>zaj-minta</svg>");
  mix-blend-mode: soft-light;
}
@keyframes drift { … }
```

Ez nem elméleti engedmény: a saját sablonjaink így élnek — az `artdeco` 9 helyen használ
SVG-textúrát, az `aurora` 3 animációt, a `scrapbook` 4 gradienst, és mindegyik 11–30 helyen
`color-mix`-szel derivál a tokenekből.

**Egyetlen tényleges tiltás:** ne legyen a CSS-ben olyan **beégetett hex**, ami nem a
tokenből származik és nem semleges (fehér/fekete/átlátszó). Ha egy szín „ennek a designnak
a lelke", tedd be a `:root`-ba saját változóként, tokenből derriválva.

**Tesztelhető, add magad is:** cseréld ki a 11 token értékét egy sötét készletre (pl.
`--cit-bg:#12100e`, `--cit-ink:#f3ece2`, `--cit-accent:#c8a45c`). Ha az oldal ettől
átöltözik és ép marad, jó. Ha szétesik, van valahol beégetett szín.

#### És ha a 11 szerep kevés?

**Előfordulhat, és tudni akarunk róla.** Ma pontosan egy akcent-szín van — egy „két erős
szín egymás ellen" típusú terv ezt megérzi. Ha a formanyelvedhez hiányzott egy szerep
(második akcent, gradiens-pár, textúra-slot), **NE hallgasd el és ne kerüld meg csendben**:
oldd meg saját változóval, és **írd bele az átadott leírásba, hogy mi hiányzott.**
Ez konkrét bemenet nekünk a szótár bővítéséhez.

### 4.2 Szekciók — ez a 9 építőelem létezik

A motor ezeket a szekció-típusokat tudja adatból feltölteni. Más nincs.

| kind | mit tartalmaz | kötelező? |
|---|---|---|
| `hero` | név, alcím, fő fotó, elsődleges CTA | **IGEN, mindig az első** |
| `features` | bemutatkozó szöveg + felszereltség/kiemelések | ha van adat |
| `stats` | 2–4 nagy szám (értékelés, szobaszám, alapítás éve) | ha van adat |
| `gallery` | fotórács / mozaik | ha van ≥1 fotó |
| `rooms` | szoba-/apartman-kártyák (név, kapacitás, ár, fotó) | ha van adat |
| `reviews` | vendég-idézetek szerzővel | ha van adat |
| `faq` | kérdés-válasz | ha van adat |
| `location` | térkép + megközelítés + kapcsolat | ha van cím/koordináta |
| `enquiry` | **érdeklődés/foglalás űrlap** — a konverziós gerinc | **IGEN, mindig** |

**Kulcs-szabály:** *van adat → a szekció megjelenik; nincs adat → a szekció KIMARAD.*
Soha nincs üres szekció, üres keret, „Hamarosan" felirat vagy kitalált töltelék.

### 4.3 Modul-horgok — a viselkedő részek jelölése

A dinamikus részekre tegyél stabil adat-attribútumot, mert a motor futásidőben cseréli
ki őket valódi widgetre:

```html
<section data-cit-module="booking"  data-cit-variant="bar">…</section>
<section data-cit-module="gallery">…</section>
<section data-cit-module="reviews">…</section>
<section data-cit-module="map">…</section>
```

### 4.4 JavaScript nélkül is teljes értékű

A lapnak **kikapcsolt JS mellett is** végig kell működnie: minden tartalom látszik, az
érdeklődés-űrlap elküldhető (`mailto:` vagy sima `POST` fallback), nincs üres sáv.

- Scroll-animációt csak **progresszív ráépítésként** csinálj: a tartalom alapból LÁTSZIK,
  a JS teszi rá az animációt — nem fordítva. (Ez nálunk mért, valós bukás volt: JS nélkül
  üres lapot szállítottunk.)
- Carousel/lightbox: JS nélkül essen vissza egyszerű görgethető sávra vagy rácsra.

### 4.5 Két méret, két terv

- **Mobil: 390 px szélesség.** Itt nézi meg a tulaj. Itt dől el minden.
- **Asztali: 1440 px.** Itt foglal a vendég. Ne csak „széles mobil" legyen: a plusz helynek
  vigyen tartalmat (kéthasábos törzs, ragadós oldalsáv, nagyobb galéria-ritmus).
- Hero magasság: `100svh`, `min-height: 640px`.
- Mobilon az elsődleges CTA legyen elérhető görgetés nélkül is (pl. fix alsó sáv) — **de
  a teljes foglalási űrlap NE az első képernyőn legyen** (lásd §5).

### 4.6 Szöveg és ikon

- **Emoji TILOS.** Minden ikon inline SVG, `stroke="currentColor"`, hogy örökölje a tokent.
- A feliratok magyarok a mintában, de a rendszer fordítja őket — **ne tervezz olyan
  elrendezést, ami csak rövid magyar szóval áll össze** (a német/lengyel fordítás 40%-kal
  hosszabb lehet).
- A szállás **neve uralja az első képernyőt**. Nincs külön sarok-logó a hero-ban: egy
  hangsúly van, és az a név.

---

## 5. A DRAMATURGIA — a szekciók sorrendje nem ízlés kérdése

A lap egy meggyőzési ív. **Ebben a sorrendben:**

1. **Elcsábítás** — hero, fotók, hangulat. Itt semmit nem kérünk a látogatótól.
2. **Ajánlat** — mit kap: szobák, szolgáltatások, árak.
3. **Bizalom** — vélemények, valós számok, hely és megközelítés.
4. **Konverzió** — **itt**, a lap alsó, döntési zónájában áll a teljes érdeklődés/foglalás felület.

⛔ **A teljes foglalási űrlap az első képernyőn tilos.** Ez nálunk konkrét, tulajdonosi
elutasítást hozó hiba volt: nem lehet foglalást kérni azelőtt, hogy vágyat építettünk volna.
Elsődleges CTA-gomb fent lehet (az az űrlapra ugrik) — maga az űrlap nem.

---

## 6. TILTÁSOK — összefoglalva

| ⛔ Tilos | Miért |
|---|---|
| Emoji ikonként | Kézműves benyomás; inline SVG a szabvány |
| Tokenből nem derivált, beégetett hex a CSS-ben | Elöli a 19 palettát; a fotó-derivált akcent nem érvényesül (§4.1 — gradiens/textúra/animáció ettől még szabad!) |
| Kitalált tény (ár, m², ★, díj, távolság, évszám) | §7.1 — jogi és bizalmi kockázat |
| Üres szekció / „Hamarosan" / lorem | Ez egy éles ajánlat, nem portfólió-darab |
| Fix magasság, ami üres helyet tart | A szekció simuljon a tartalomhoz, főleg mobilon |
| Teljes foglaló-űrlap az első képernyőn | Megöli a konverziós ívet (§5) |
| Csak-JS tartalom | JS nélkül üres lapot szállítanánk |
| Külső CSS/JS framework (Tailwind CDN, Bootstrap, React) | A kimenet statikus HTML; a motor sablonná alakítja |
| Sarok-logó a hero-ban a név mellé | Két hangsúly = nincs hangsúly |

---

## 7. AMI MIATT A LEGTÖBB TERV MEGBUKIK NÁLUNK

Ezt a négy pontot olvasd el kétszer. Az összes eddigi külső és belső bukásunk ide vezethető vissza.

### 7.1 Tényhűség — soha nem találunk ki tényt

Ár, négyzetméter, szobaszám, csillag-értékelés, díj, „200 m a parttól", alapítási év:
**csak valós forrásból.** Ha nincs adat, a szekció kimarad — nem tippelünk, nem szépítünk.
Elv: **„bizonytalanság → kevesebb, sosem hamis."**

Neked ez azt jelenti: a designban **ne legyen olyan hely, ami hazudik, ha üres marad**.
Egy „★★★★★" díszítés, ami akkor is 5 csillagot mutat, ha az értékelés 3,8 — ez kizáró ok.

### 7.2 A tervező szabad a SZERKEZETEN, kötött a TÉNYEKEN

A szerkezet, a ritmus, a paletta, a tipográfia, az elrendezés: a te terepe, teljesen szabadon.
A számok és állítások: nem.

### 7.3 A generikus töltelék halálos

„Kellemes környezet", „családias hangulat", „tágas kert és saját parkoló" — ezek a mondatok
azért fájnak, mert *bármelyik* szállásra igazak. A tervnek **helye kell legyen a konkrétumnak**:
a szállás egyedi, megkülönböztető tényének (nálunk ez a „mag": pl. *„szarvasles a dézsából"*,
*„1928 óta ugyanaz a család"*, *„saját strand"*). Adj neki kiemelt vizuális helyet.

### 7.4 ⚠️ AZ ADATHIÁNYOS ESET A VALÓDI PRÓBA

**A leadjeink kb. 85%-áról alig van adat.** Nincs szoba-lista, nincs vélemény, nincs ár,
van 2 közepes fotó. **Mégis ki kell mennie egy oldalnak, ami elad.**

Ez a mi legdrágábban megtanult leckénk: minden tervezés a dús adaton történik, és pont
az adathiányos ág lesz a vak folt — ott, ahol a kimenet a legrosszabb.

Ezért **kötelező a második fájl** (`-starved.html`) a JSON `_starvedVariant` csomagjával:
2 fotó, 3 kiemelés, se szoba, se vélemény, se ár, se stat, se GYIK.

Az elfogadás feltétele: **ez a változat is teljes értékű, nem csonka lap.** Nincs benne
üres sáv, nem kong, és nem érzik rajta, hogy „hiányzik valami". Ha a formanyelved csak
6 fotóval és 3 szobával működik, a terv nálunk használhatatlan.

---

## 8. A MINŐSÉGI MÉRCE

### 8.0 A „wow" három legnagyobb kara — itt légy bátor

A cél nem a „rendes weboldal", hanem hogy a tulaj felszisszenjen. A tapasztalatunk szerint
ezen a három ponton dől el, és **egyiket sem korlátozza a token-kontraktus**:

1. **A fotó kezelése.** A nyers, közepes minőségű fotó a legnagyobb ellenségünk. Duotone,
   szemcse, erős scrim-dramaturgia, maszkolt forma, kivágás, `mix-blend-mode` — ezek egy
   gyenge képből is hangulatot csinálnak. Ez a legnagyobb kar, és a legkevésbé kihasznált.
2. **Tipográfiai bátorság.** A lenti hero-számok **alsó küszöbök, nem plafonok.** Ha a
   formanyelved bírja, menj `clamp(48px, 12vw, 160px)`-ig, vágj bele a képbe a betűvel,
   használj ritkított verzált szekció-számozást, negatív térrel dolgozz.
3. **Mozgás és mélység.** Parallax, Ken-Burns, scroll-vezérelt réteg-eltolás, hover-emelés.
   (⚠️ JS nélkül is álljon a lap — §4.4 —, és `prefers-reduced-motion` esetén álljon meg.)

### 8.1 Alap-mérce

Amit „kész, profi oldalnak" tekintünk (a saját referencia-készletünkből desztillálva):

**Hero**
- `height: 100svh; min-height: 640px`, full-bleed fotó
- gradiens-scrim a fotón, hogy a szöveg **bármilyen világos fotón is olvasható** legyen
  (worst-case kontraszt ≥ 3,0 — ezt gépileg mérjük)
- eyebrow: 12–13 px, `letter-spacing: 5px`, uppercase, akcent színnel
- display-cím: **legalább** `clamp(40px, 7vw, 78px)`, `line-height: ~1.05`, max ~14–16 karakter/sor
- CTA-pár: töltött + körvonalas, `padding: 15px 34px`, uppercase, `letter-spacing: 2.5px`

**Tipográfia**
- Display + body párosítás (jellemzően szerif display + sans body, de ez tőled függ)
- Minden szekció-fej: eyebrow (akcent, ritkított, uppercase) → nagy h2 `clamp(30px, 4.5vw, 50px)`

**Ritmus és részlet**
- Szekció-padding: 90–110 px felül/alul
- Hover-mikrointerakciók: kép-zoom `scale(1.04)`, kártya-emelés
- Kártyák: `border-radius: 6–16px`, finom `box-shadow`
- Ragadós navigáció + gazdag lábléc (ez adja a „keret", a „ez egy igazi oldal" érzetet)

**Gazdagság**
A „teljesség" érzetét a szekció-készlet adja: nav → hero → bemutatkozó + felszereltség-rács
ikonokkal → szoba-kártyák árral → galéria-mozaik → vélemény-sáv → GYIK → térkép + kapcsolat
→ **érdeklődés** → lábléc.

---

## 9. AMI MÁR VAN — ne ezeket hozd újra

A cél a **sokszínűség**: ugyanabban a régióban ne nézzen ki két szállás oldala egyformán.
Ezért az alábbi 16 irány már foglalt. Ha az ötleted ezek valamelyikének változata, dobd el.

| # | Irány | Formanyelv |
|---|---|---|
| 1 | `fullbleed` | Teljes-képernyős hero, üveg foglaló-sáv |
| 2 | `dark-luxury` | Sötét luxus, cinematic, brass akcent |
| 3 | `card-sidebar` | Fotó-mozaik fejléc, ragadós foglaló-kártya (hirdetés-stílus) |
| 4 | `editorial` | Újság-masthead, dropcap, kontakt-lap galéria |
| 5 | `parallax` | Immerzív parallax panelek, pont-nav, stat-sáv |
| 6 | `brutalism` | Vastag keretek, acid akcent, marquee |
| 7 | `dopamine` | Élénk, játékos, sticker-stílus |
| 8 | `horizontal` | Vízszintesen görgethető fejezetek/szoba-sín, sötét irodalmi |
| 9 | `cinematic` | Ken-Burns crossfade hero, ragadós foglaló-dokk |
| 10 | `transit` | Sötét indulási-tábla / kiosk, egységek táblázatban |
| 11 | `organic` | Antigrid szórt kártyák, blob-formák, agyag-moha-len |
| 12 | `artdeco` | Központi poszter-hero, éjkék-réz, deco ornamensek |
| 13 | `scrapbook` | Papír-emlékkönyv, ragasztott polaroidok, kézírás |
| 14 | `watercolor` | Lágy akvarell vízkék-korall, hullám-elválasztók |
| 15 | `aurora` | Sötét üveg app, animált aurora háttér, hero-dashboard |
| 16 | `claymorphism` | Neumorf agyag felület, puha wellness |

**Amerre szívesen mennénk (nem kötelező, csak irány):** svájci/rácsos tipográfiai szigor ·
retro nyomdai (risograph, offset-regiszter) · terminál/monospace-adat-esztétika ·
botanikai atlasz / illusztrált metszet · japán ryokan-minimalizmus (`ma`, negatív tér) ·
térkép/kartográfia-vezérelt · borcímke-heraldika · nyomott textil / kékfestő motívum.

---

## 10. ÁTADÁS ÉS ELFOGADÁS

**Amit átadsz:**

1. `<nev>-rich.html` — a dús adatcsomaggal
2. `<nev>-starved.html` — az adathiányos csomaggal
3. Fél oldal leírás: a formanyelv lényege, kinek való, mi az egy megkülönböztető gondolat

**Elfogadási checklista** — ezen fut végig a bírálat:

- [ ] Megnyílik build nélkül, konzol-hiba nélkül
- [ ] `:root` kiadja mind a 11 `--cit-*` szerepet (**a te értékeiddel**), és nincs a CSS-ben
      tokenből nem derivált, beégetett hex
- [ ] A 11 token sötét készletre cserélve az oldal átöltözik és ép marad
- [ ] A leírás megválaszolja: **mit nem tudtál kifejezni a 11 szerep alatt** (vagy hogy semmit)
- [ ] 390 px és 1440 px: mindkettő önálló, végiggondolt elrendezés
- [ ] JS kikapcsolva: minden tartalom látszik, nincs üres sáv, az űrlap küldhető
- [ ] `hero` az első; `enquiry` jelen van; a teljes űrlap NEM az első képernyőn
- [ ] `data-cit-module` horgok a dinamikus szekciókon
- [ ] Nincs emoji; minden ikon inline SVG `currentColor`-ral
- [ ] Nincs a mintán kívüli kitalált szám, ár, csillag, díj
- [ ] **Az adathiányos változat is teljes értékű lap** (ez a leggyakoribb bukó)
- [ ] Vizuálisan nem a §9 tizenhat iránya közül való

**Bírálat:** a két HTML-t 390 px-en és 1440 px-en screenshotoljuk, gépi dizájn-ellenőrzőn
átfuttatjuk (token-teljesség, emoji, üres sáv, hero-kontraszt), és a tulaj dönt a képek alapján.
Módosítási kört kérhetünk.

---

## 11. JOGI / ADATVÉDELMI MEGJEGYZÉS

A mintában szereplő fotó-URL-ek placeholderek. Éles működésben a képek jogállását
nyilvántartjuk (tulajdonosi / portál / Google Places / Street View), és a hideg megkeresésnél
kiküldött oldal láblécében kimondjuk, hogy **előzetes terv**, nem a szállás hivatalos oldala.
Neked ebből annyi a dolgod, hogy **a láblécben legyen hely egy ilyen jelölő sávnak.**

---

*Kérdés esetén: a brief pontosítható. Ami NEM alkudható: a token-kontraktus (§4.1), a
tényhűség (§7.1), a JS-nélküli működés (§4.4) és az adathiányos változat (§7.4).*
