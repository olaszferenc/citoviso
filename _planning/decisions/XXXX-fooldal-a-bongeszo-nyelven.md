## ADR-XXXX — A főoldal a látogató böngészőjének nyelvén (magyar = a mai oldal, más nyelv = euró + .com)

**Státusz:** ELFOGADVA. Tulaj-döntés 2026-11-23, a koordinátoron (`cit9b4690e3`) át: „a fordításhoz nem kell jóváhagyás”. A viselkedés kontraktusa a c2 mock (`assets/design-refs/_drafts/fooldal-orszag/c2-valodi-fooldal.html`, 23 nyelv).
**Épít:** ADR-0465 (euró ár-réteg, 7/13/18 €, .com), ADR-0103 (a domaint a Citoviso regisztrálja), ADR-0412 (fordítás csak Bábel), ADR-0036 (T()/tr()).
**Felülírja:** az ADR-0452 ① pontjának főoldal-részét („a főoldal a magyar oldal és a magyar ársor marad, nincs böngésző-tipp”). A lead-kontextusú felületekre az ADR-0452 változatlanul áll.

### Döntés
① **A nyelvet az `Accept-Language` dönti el.** A q-sorrendben az első olyan nyelv, amelyre a főoldal TELJESEN le van fordítva. Ha egyik sincs, angol (header nélkül is). Nincs választó, nincs sáv, nincs URL-séma, nincs IP-tipp. A válasz `Vary: Accept-Language` fejlécet kap.
② **Magyar = a mai oldal bájtra.** Forint, .hu, jutalék-számoló, Magyarországra állított térkép. Egyetlen eltérés a helyesbített domain-mondat (④).
③ **Minden más nyelv:**
   - az euró-ársor a meglévő `hr` ár-régióból (ADR-0465: 7/13/18 €, .com);
   - a naptár-szinkron és a GYIK Booking.com + Airbnb (Szállás.hu nélkül);
   - a hero „mielőtt bármit fizetnél” (nem „forintot”);
   - a példa-szállásról a szöveg kimondja, hogy magyarországi;
   - a magyar forrású jutalék-állítás helyett megtérülés-számoló;
   - térkép Európa-nézetben, ország-szűrés nélküli kereső;
   - jogi linkek `?l=<nyelv>` paraméterrel, ha arra az országra teljes a jogi csomag; különben a mai link (ADR-0458).
④ **Domain-mondat (ADR-0103) minden nyelven:** „A domaint a rendelés után a Citoviso regisztrálja és kezeli, neked nincs vele teendőd.” Kikerült a téves „a nevedre kerül” és „magától a tiéd lesz”.
⑤ **„Teljesen lefordítva” = Bábel commitolt csomagja (`src/i18n/babel/packs/<l>.json`) a főoldal mind a 123 kulcsát tartalmazza.** A 123 kulcs: oldalszöveg, kártya-sablon, futásidejű szöveg. A szerver magát a mag-fájlt olvassa (`babelSeed`), DB nélkül, így egy nyelv pontosan akkor jelenik meg, amikor Bábel csomagja lefedi. Hiányos nyelv soha nem jelenik meg félig magyarul: a következő nyelv jön, vagy az angol.

### Megvalósítás
- `src/server/homepage.ts`:
  - `homepageLang` / `homepageLangComplete`;
  - `homeTexts` / `homeClientTexts` (literál `T(l, "…")` / `tr("…")`, a katalógus innen gyűjt);
  - `foreignHomepage`: szerkezeti cserék, majd a szöveg-csomópontok és attribútumok pontos egyezéses fordítása;
  - `paybackSection`;
  - a kártya éves sora sablonból készül.
- `src/server/public.ts` `serveHomepage`: `Vary` fejléc.
- `public/assets/home/home.js`:
  - `tr()` / `trn()` a `window.CIT_HOME`-ból;
  - megtérülés-számoló;
  - nyelvfüggő térkép és kereső.
  - A fájl felkerült az i18n-listára (`scripts/i18n-sources.mjs`).
- `public/assets/home/home.css`: `.pay-*`, tokenekből.
- `public/index.html`: a két domain-mondat.

### Mérés (2026-11-23)
- A HU-render normalizált diffje a régihez képest csak a két domain-mondat. A lockup gradient-azonosítóinak számlálója folyamatonként eltér, ez nem tartalmi különbség.
- Playwright, Bábel térképeivel helyben: hu/de/hr/it/ja (ja → en), mobil + asztali.
  - helyes `lang`, € és .com, 0 magyar szó, JS-hiba 0;
  - `--p` 0 → 0,29–0,31 görgetésre;
  - megtérülés 120 € / 18 % / Teljes → 9 éjszaka;
  - hibaüzenet, tű-visszajelzés, küldés-nyugta a nyelven;
  - jogi link hr/it `?l=`, de a mai.
- Mind a 23 nyelv önállóan teljes, a látható HTML-ben 0 magyar kulcs marad.

### Maradt
- Az euró-összeg minden nyelven „13 €” alakban (a `formatPrice` nem nyelvfüggő); a futásidejű számoló már `Intl`-lel formáz.
- A minta-kérés intake-je a lead nyelvét nem kapja meg (a mai viselkedés, nem e döntés része).
- Header nélküli kérés (pl. kereső-robot) = angol oldal.

### Visszafordíthatóság
🔄 Nincs migráció. A magyar oldal változatlan. A nem-magyar ág egyetlen elágazás (`foreign`) a `renderHomepage`-ben.
