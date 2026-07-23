# Referencia-minőség — a „wow" mérce

> Ez a mappa a tulaj által leadott, **elvárt minőségű** minta-oldalakat őrzi. **Ez a mérce.**
> Minden motor-kimenetet (generált mock) EHHEZ hasonlítunk. Ha a mi kimenetünk nem éri el
> ezt a szintet, a munka nincs kész. A fájlok statikus, önálló HTML-ek — nyisd meg böngészőben,
> vagy `npx tsx scripts/engine-shot.ts assets/design-refs/reference-quality/<fájl> --width=1440`.

## A minták (mit demonstrál mindegyik)

| Fájl | Oldal | Karakter / amit mutat |
|---|---|---|
| `01-fullbleed-glass.html` | Azúr Part Boutique Hotel | full-bleed 100svh hero, **üveg (glassmorphism) foglaló-sáv** a hero alatt, központosított szekció-fejek, room-kártyák árral, amenity-rács, galéria-mozaik (span), vélemény-sáv színes háttéren, GYIK, térkép+kapcsolat, gazdag lábléc |
| `03-dark-luxury.html` | Silva Resort & Spa | **sötét luxus**, 100svh hero gradiens-scrimmel + eyebrow + CTA-pár, sötét foglaló-panel, **vízszintes scroll suite-kártyák**, rituálé-rács vonalráccsal, eltolt galéria, **idézet-sáv** (quote-band), GYIK+házirend, brass accent |
| `04-card-sidebar.html` | Diófa Vendégház | **Airbnb-szerű**: foto-mozaik fejléc, tartalom + **ragadós foglaló-kártya oldalt** (ársorral, összesítővel), host-blokk, amenity-lista, értékelés-sávok (rating bars), mobil fix foglaló-sáv |
| `05-editorial.html` | Kékfestő Porta | **szerkesztői/újság**: masthead + sticky nav, vezércikk dropcap-pel, **kupon-stílusú foglaló**, szoba-oszlopok, „apróhirdetés" felszereltség, contact-sheet galéria (elforgatott polaroidok), „levelek a szerkesztőnek" vélemények, program-táblázat, GYIK |
| `06-immersive-parallax.html` | Nordwand Chalet | **parallax panelek** (fixed bg), **oldalsó pont-nav**, ragadós dark foglaló-dock, **stat-sáv** (accent-vonalas számokkal), váltakozó (flip) egység-sorok spec-chipekkel, amenity-rács hoverrel, szezon-váltó árlista, sötét vélemény-sáv, gazdag lábléc |

## A KRAFT-STANDARD (ellenőrzőlista — ehhez mérünk)

Amitől ezek „wow"-ok, és amit a motor-primitíveknek hozniuk KELL:

### Hero (a legfontosabb horog — „above the fold")
- **Teljes/közel-teljes magasság**: `height:100svh; min-height:640–660px` (vagy legalább ~82vh).
- **Full-bleed háttérkép** + **gradiens-scrim** (`linear-gradient(180deg, rgba(dark,.25), rgba(dark,.9))`).
- **Eyebrow/kicker**: `font-size:12–13px; letter-spacing:5–6px; text-transform:uppercase; color:accent`.
- **Óriás display-cím**: `clamp(40px, 7vw, 78–104px)`, szerif display, `line-height:~1.05`, `max-width:~14–16ch`.
- **Alcím** halványabb, `max-width:~480–560px`.
- **CTA(-k)**: töltött + (opc.) körvonalas; `padding:15px 34px; letter-spacing:2.5px; uppercase`.

### Tipográfia
- **Szerif display + sans body** párosítás (Cormorant/Fraunces/Marcellus/Playfair + Jost/Figtree/Karla/Archivo).
- Minden szekció-fej: **eyebrow (accent, letter-spaced, uppercase) → nagy h2 (`clamp(30px,4.5vw,50px)`)**.

### Foglalás (a konverziós elem — prominens, sosem árva!)
- Kiemelt **foglaló-sáv/panel/kártya**: üveg (blur) VAGY sötét dock VAGY ragadós oldal-kártya.
- Mezők rácsban (`repeat(4,1fr) auto`), nagy submit gomb. Mobilon fix alsó foglaló-sáv.

### Gazdag szekció-készlet (ettől „teljes" az oldal)
- **Sticky nav** (brand + linkek + CTA, scrollra átúszó háttér).
- **Szoba/egység-kártyák árral** (kép, név, m²/fő chipek, ár, „Foglalás").
- **Amenity-rács ikonokkal** (2–4 oszlop, hover).
- **Galéria-mozaik** (aszimmetrikus span-ek, nem egyenrács).
- **Vélemény-sáv** (csillagok, idézet, név — gyakran színes/sötét háttéren).
- **GYIK-harmonika** (`<details>`), **térkép + kapcsolat**, **gazdag lábléc** (oszlopok, jogi linkek, NTAK).

### Ritmus / részletek
- Szekció-padding **`90–110px 0`**; nagyvonalú belső térköz.
- Hover-mikrointerakciók (kép-zoom `scale(1.04–1.06)`, kártya-emelés), scroll-reveal.
- Kártyák: `border-radius:6–16px`, finom `box-shadow`.

## A rés (2026-07-23 diagnózis) + a terv

**Hol tévedtünk:** a motor egy **vékony 4-primitíves vázat** kapott (hero/features/gallery/enquiry,
minimál CSS), és a kit-passzok ennek a **kombinatorikáját** (skin×archetípus×variáns) húzták fel —
nem a fenti **gazdag, kézműves szekció-készletet**. A sokszínűséget optimalizáltuk, nem az alap kraftot.

**Első javítás (2026-07-23, kész):** immerzív hero (full-bleed + scrim + eyebrow + nagy display + CTA)
+ prominens érdeklődés-sáv + nagyvonalúbb ritmus/tipó a `src/engine/primitives.ts`-ben.

**A hátralévő terv (a mércéig):**
1. sticky nav + gazdag lábléc + polírozott foglaló-sáv (a „keret", ami minden oldalt késszé tesz);
2. gazdag szekció-modulok: amenity-rács · szoba/egység-kártyák · vélemény-sáv · GYIK · térkép+kapcsolat
   (a `_planning/DOMAIN/05-MODULES.md` katalógus szerint).

**Tényhűség (§B.17):** a minták részben azért gazdagok, mert konkrét adattal (ár, m², vélemény,
értékelés) vannak tele — ezt scrape-elt leadnél NEM találjuk ki. A hideg-outreach MOCK-ban a gazdag
szekciók **jelölt, reprezentatív minta-állapottal** tölthetők (ADR-0015 + §B.17 fázis-határ); az ÉLES
oldalra csak valós adat-fedezettel kerülnek. A kraft (hero, tipó, ritmus, nav, lábléc) adat-független
→ az azonnal alkalmazható.
