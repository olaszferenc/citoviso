# KONTRAKTUS — „Séta a kapun át” sablon (`walk-through`)

**Jóváhagyta:** a tulaj, 2026-10-02 (mock-verseny egy valós leaden: Három Huszár Apartments, Köveskál;
a „B” változatot a saját gépén nyitotta meg, és ezt írta: „annyira jó lett, hogy hozzuk létre a
Citoviso-n generálható típusként”). A koordináló session briefje hozta (`~/rc-briefs/seta-sablon.md`).
**Terv:** `plan.html` (az elfogadott, önhordó mock, képei az `img/` alatt) · `terv.md` (a dizájnterv B szakasza) ·
**A tulaj képernyőképe:** `tulaj-jovahagyas-asztali.webp` (asztali hős) ·
**Képek:** `terv-mobil.png`, `terv-asztali.png` (az elfogadott terv első képernyője) ·
**Hatókör:** `src/engine/templates/walkThrough.ts` · `src/engine/motion.ts` · `src/engine/skins.ts` · `src/engine/recipe.ts` · `src/generator/heroPick.ts` · `src/engine/siteData.ts` · `src/console/tplPreview.ts`
(a sablon; a görgetés-történet motorja; a `gravel-grotesque` skin; a `Photo.subject` mező és útja) · Döntés: ADR-0304.

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kész sablont ehhez mérjük.

## KÖT — a kinézet és a szerkezet (a terv szerint)

1. **Szöveg-elsős hős:** hely-sor, óriás groteszk cím (a szállás neve), rövid bevezető, két pirula-gomb
   (foglalás + séta-ugrás), mellette (asztal) / alatta (mobil) **háromfotós lépcsős kollázs**.
2. **Számok-sáv** vastag vonal alatt (asztal: egy sor, függőleges elválasztók; mobil: 2×2).
   ⛔ A tulaj képernyőképén a számok HIÁNYOZTAK: a mock a vonal alól csak görgetésre csúsztatta fel
   őket, és a sáv az első képernyő alján még nem sült el. **Az első képernyő tartalma soha nem vár
   görgetésre** — a sablonban a felcsúszás betöltéskor fut le.
3. **A séta:** ragadós, lekerekített képpanel (asztal: bal oldalt 7/12, mellette a lépések nagy címmel;
   mobil: a fotó kitölti a képernyőt, a lépés-kártyák felette úsznak el), a képek görgetésre egymásba
   úsznak (áttűnés + 1,08-ról közelítés), vékony haladásjelző. JS nélkül / csökkentett mozgásnál /
   képkészítő eszköznél kép+szöveg párok, minden látszik.
4. Szobák vonalas sorokban; galéria magas cellás rácsban; értékelés teljes szélességű **accent sávon**;
   GYIK lenyíló sorokkal; sötét záró sáv a foglalási felülettel; lábléc.
5. Mozgás-fegyelem: csak transform/opacity, IntersectionObserver (nincs scroll-figyelő a sétában),
   reduced-motion alatt statikus, JS nélkül minden látszik.

## KÖT — ami a RENDSZERBŐL jön, nem a mockból

- **Funkciók:** foglalás/ajánlatkérés (`bookingSlot` + a `closing` slot közös foglalási szekciója),
  galéria-nagyítás (közös lightbox, `data-cit-module="gallery"`, minden fotó a slotban, a többi a
  galéria-kontraktus szerinti kinyitó gomb mögött), szoba-kártya (`roomShell`/`roomHint`/`roomDetails`),
  értékelés/térkép/házirend/programok a közös slotokból (`showcase` · `trust` · `practical` · `closing`),
  telefonos menü és foglalás-sáv a közös runtime-ból (ADR-0253: a sáv csak félúton).
  A mock saját űrlap-szkriptje csak a viselkedés mintája volt.
- **Szöveg:** a SiteData-ból és a copywriter-rétegből; minden vevő-oldali felirat `T()`-vel.
- **A séta lépései adatvezéreltek:** a fotók vision-ítéletéből (`Photo.subject`), a vendég útjának
  sorrendjében: kívülről → kert/udvar → kilátás → asztal → belül; tárgyanként egy, a legjobb helyezésű
  fotó; a hős-kollázs képei nem ismétlődnek. A lépés címe a tárgyat nevezi meg, **bekezdés nincs**:
  egy fotótól független (bár forrásolt) mondat a kép mellé téve a KÉPRŐL állítana (tényhűség-őr, 2026-10-02).
  Kitalált mondat sehol (§B.17).
- **Kevés adat:** három lépésnél kevesebb → nincs séta (a szakasz címe ekkor nem „séta”, a
  kiemelések maradnak); nincs értékelés → nincs accent sáv és nincs szám-cella; nincs valódi GYIK →
  nincs GYIK; élesen szoba nélkül → nincs szoba-szakasz. Üres doboz sehol.

## Ami a terv szerint NEM dőlt el (a koordinátornak átadva, lásd a session-jegyzetet)

- a séta 3-nál kevesebb tárgyú leadeken (pl. csupa belső fotós apartman) — ma: elmarad;
- az accent szín: a sablon a többi sablonhoz hasonlóan a fotókból vett akcentust használja, ami a
  Három Huszár-on terrakotta, nem a mock lombzöldje;
- a foglalási szakasz a közös modul űrlapja (naptár), nem a mock kétlépcsős ajánlatkérője.
