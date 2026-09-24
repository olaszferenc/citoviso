# Platform-levelek kerete — jóváhagyott terv (A · Tiszta kártya, E4 logó)

**Jóváhagyva:** 2026-09-24, tulajdonosi döntés (§2b terv-kapu). A kiváltó ok a tulaj szavával:
„ezek nem túl profi vállalat benyomását keltik" (belépési + számla-levél, Gmailben nézve).
**Vázlat:** `platform-emails.html` (A/B/C változat; az **A** a jóváhagyott, a B és a C elvetve).
**Megvalósítás:** `src/email/platformLayout.ts` — minden platform-levél ezen a kereten megy.

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **Fejléc = a „szem”itoviso logó**: az E4 márkajel áll a „C” betű helyén, utána „itoviso”
   (`assets/brand/citoviso-logo-email.png`, 492×108, 164×36 px-en jelenik meg). ⛔ NEM a régi,
   sötétkék C-ívű `public/assets/ui/lockup-gradient.svg` (azt az E4 felülírta, lásd `../brand-mark/`),
   és NEM szöveges „CITOVISO.” szóvédjegy. Csak ha a PNG hiányzik, akkor jön a szöveges tartalék.
2. **A logó CID-inline kép**, nem hivatkozott URL: a Gmail nem mutat SVG-t, a `data:` URI-t tiltja,
   a hosztolt kép pedig az éles deploytól és a Google képproxy elérhetőségétől függene.
3. **A feladó neve „Citoviso”** (`PLATFORM_FROM_NAME`); a cím a hitelesített postafiók marad.
   Rendszerlevél nem jöhet személynév alatt.
4. **Lábléc a cégadatokkal** a `config.legalEntity`-ből (név, székhely, adószám, e-mail, telefon),
   plusz ha a levél egy oldalról szól: „Ezt a levelet azért kapta, mert a(z) X oldalát a Citovisónál
   rendelte meg.” Csak a kitöltött mező jelenik meg, semmit nem találunk ki (§B.17).
5. **Megszólítás:** magánszemélynek „Kedves {név}!”, cégnek vagy ismeretlen olvasónak „Kedves Partnerünk!”
   („Kedves Boróka Kft.!” körlevélnek hat).
6. **Egy fő gomb, sötétkék** (`#0e2a47`), táblázatból építve (az Outlook így rajzolja ki).
   Adat-panel: címke/érték sorok; a jelszó monospace, az összeg kiemelt, és nem törik el
   az ezres elválasztónál.
7. **Mobil (≤520 px):** keskenyebb margó, a címke/érték sorok egymás alá kerülnek.
8. **A belépési levél megnevezi az oldalt** (tárgyban és szövegben is), a „jegyezze fel” csak egyszer szerepel.

## Hatókör

Belépési levél, számla-levél, a 7 díj- és felszólító levél (`billingEmail.ts`) és a 3 domain-levél
(`domainEmail.ts`). A havi forgalmi (`trafficEmail.ts`) és a programajánló (`programsEmail.ts`) levélnek
saját, korábban jóváhagyott kerete van; az outreach szándékosan személyes hangú, ezért egyik sem ide tartozik.
