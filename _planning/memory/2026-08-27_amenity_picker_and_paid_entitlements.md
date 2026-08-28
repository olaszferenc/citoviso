# 2026-08-26/27 — Felszereltség-választó (ADR-0074) + „azt kapja, amiért fizetett" (ADR-0072)

**Szál:** `wt/cit214244a1` · **Landolt:** `ea15f70` (ADR-0072), `02c20ab` (F terv), `f652dab`
(KB-őr FLAG-ek), `85a3673` (vendég-oldali ikonok)

## A terv-kapu ELŐSZÖR futott végig úgy, ahogy kell

Tegnap ebből lett a baj (panaszból felhatalmazást olvastam ki, csatornát cseréltem, doktrínát
írtam át — ADR-0068 visszavonva). Ma a sorrend tartott: **terv → megállás → tulaj dönt → kód.**

A tulaj a D (ikonos csempék) és E (keresős lista) közül **kombinációt** választott: *E feje
(kereső + kiválasztottak chipként) D testén (ikonos csempék)*. Ezt legyártottam F változatként,
kattinthatóan, végigteszteltem (kereső 1 találat „stég"-re, chip-×, örökölt csempe nem
kapcsolható, 0 db 30px alatti koppintó-felület), és **csak a jóváhagyás után** kezdtem kódolni.

⭐ **Mért terv-lelet, ami a kódot megelőzte:** a D 390px-en elveszti a csempe-rácsot (a
`minmax(158px)` egyoszlopossá esik → 4314px görgetés). 128px-re víve **2880px**, kétoszlopos.
Ha ezt kódban fedezem fel, már a rossz alapon állt volna minden.

## ADR-0074 — a választó

- **Katalógus:** 70 tétel / 10 kategória, tételenként saját SVG (`src/tenant/amenityCatalog.ts`).
- ⭐ **A TÁROLT ÉRTÉK A MAGYAR CÍMKE, nem az id** — szándékosan. A meglévő csatornák (modul-config
  `items`, `site_unit.amenities`) tulaj-szövegezésű stringeket tartanak, és a multilang a
  tartalom-stringet fordítja. Címke-tárolással **nincs migráció**, minden meglévő sor és a
  fordítási út érintetlen; a címke MAGA az i18n-kulcs (a fájl a `extract-i18n` DATA_FILES-án).
  A picker így UI-réteg a mai adat fölött, nem új adatcsatorna (ADR-0059 „beszövés" elve).
- **Hatókör tétel-szinten** (property/unit/both), és a szabály a **MENTÉSEN is** él.
- **Öröklés:** a szállás-szintű pipa a szoba-kártyán szürke, szaggatott, nem kapcsolható csempe.
- **Jogosultság (tulaj-döntés):** szobánkénti felszereltség = `rooms` ÉS `amenities` együtt.
  Modul nélkül **konverziós panel** (ajánlat + halvány valódi csempék), nem hibaüzenet.

## ADR-0072 — a pénz-oldali lelet, amit a tulaj vett észre

A tulaj all-in modulkészletet állított be egy teszt-tenantnak, és feltűnt neki az eltérés.
Megmérve: **három ÉLŐ tenant tartott nem fizetett modult** — Villa Suzy 10-et (3-at fizetett a
13-ból), Nyugalom Vendégház 12-t (nulla rendeléssel), Aszfalt a 14 900 Ft-os multilangot.

⭐ **A mechanizmus nem kiskapu volt, hanem ADDITÍV ÍRÁS:** a `convertLead` és az `activateUpsell`
is `onConflict … doUpdateSet({ active: true })`-tal ír — **csak bekapcsol, sosem kapcsol ki**. Az
operátor fizetés ELŐTTI ALL-IN előnézete (ADR-0014 engedi!) ezért **túlélte** az utána futó
fizetett aktiválást. Egyik kapu sem hazudott zöldet: **nem volt kapu.**

Javítás: egy igazságforrás (`paidEntitlements.ts`), a **két** pénz-úton hívva. ⚠️ Az indulónál
a **LIVE render ELŐTT**, mert a `moduleContentFor()` a jogosultságokból renderel — utána
egyenlítve a nem fizetett modul már kikerült volna a publikus oldalra. A `provisioned` privát
előnézet szándékosan kivétel (ADR-0014: az a konverziós horog).

## Vendég-oldali ikonok (ADR-0074 ① kész)

A modul-blokk minden tételre EGY közös pipát tett. Most tételenként a katalógus saját ikonja áll —
egy vizuális nyelv a szerkesztőben és a honlapon. **Egy rétegben, nem 16-ban:** közös resolver
(`amenityIcon.ts`), bekötve a modul-blokkba, a `featuresAmenities` primitívbe és mind a **16
sablon** saját highlight-szekciójába (mindegyik közvetlenül a régi kulcsszó-illesztőt hívta).

⚠️ **A fordított oldal külön gondolat volt:** a multilang a render ELŐTT cseréli a stringeket, a
magyar exact-match elveszne. Híd: `SiteData.amenityIconMap` — az `applyTranslationMap` az
egyetlen pont, ahol forrás és fordítás EGYÜTT van a kézben, ott rögzül a fordított-címke →
katalógus-id pár. Német címke alatt is a saját ikon áll (az őr méri).

## Módszertan — amit az őrök fogtak, és én nem

1. ⭐ **Az `amenity-picker-check` VALÓDI rést talált:** a hatókör-szabály megkerülhető volt az
   „Egyéb" mezőn át (a szobánál beírt „Medence" szabad szövegként tárolódott volna). A picker
   kapuzott, a szabad szöveg nem — **a kerülőút mindig a nem-kapuzott bemenet.**
2. **A `tudasbazis-or` FLAG-je három tételes volt, mind jogos:** ① a szállás-szintű képernyő
   súgója a generikus settings-entry-re esett (a coverage-kapu formailag zöld volt, mert az
   anchor „fedte" — **érdemi hézag gépi zöld mögött**); ② a rooms-entry a Fotók fülre küldte a
   tulajt, miközben a kártya a „Képek választása" gombra — ellentmondó súgó rosszabb a
   hiányzónál; ③ a screenshot nem mutatta az entry fő témáját (a picker a hajtás alatt volt) →
   elem-szintű felvétel, determinisztikusan.
3. **A saját tesztem hibázott, nem a termék:** a Playwright `check()`-kel a rejtett checkboxra
   kattintott — a valódi felhasználó a CÍMKÉRE koppint. A gesztust kellett javítani.
4. **Két hamis riasztás a route-alak mérésében:** a szeletelésem az első `return redirect`-nél
   vágott (az a login-ág), és a `--self-test` a legveszélyesebb hibamódot (a `prospect→lead` ág
   elvágása = a fizető vevő megfosztása mindentől) helyesen pirosra vitte.

## Multilang fizetés nélküli aktiválódás — kivizsgálva, NEM kód-lyuk

Az idővonal döntött: a két fizetetlen generálás **20:35–20:48**-kor futott, a modul kódja aznap
**22:58**-kor landolt, és a fizetés-kapu (`pending_payment` → elutasít) **már az első commitban**
benne volt. Vagyis az ADR-0063 fejlesztő szálának még-nem-landolt munkafájából futott teszt.
A mai úton a generálást kizárólag a webhook indítja fizetés után. **Teendő nincs.**

## Módosított fájlok

- `src/tenant/amenityCatalog.ts`, `src/engine/amenityIcon.ts` (újak)
- `src/tenant/paidEntitlements.ts` (új) · `src/payment/service.ts`
- `src/server/moduleConfigViews.ts` · `src/server/public.ts` · `src/moduleConfig.ts`
- `src/engine/{recipe,moduleSections,primitives}.ts` + mind a 16 `src/engine/templates/*.ts`
- `src/tenant/multilangCore.ts` · `src/i18n/catalog.json` · `scripts/extract-i18n.mts`
- `public/assets/ui/citui-admin.css`
- `scripts/{amenity-picker-check,entitlement-paid-check}.mts` (újak) · `hooks/pre-commit`
- `scripts/kb-shot.mts` · `kb/entries/admin-modules-amenities/` (új) ·
  `kb/entries/admin-modules-{rooms,settings}/`
- `assets/design-refs/tenant-admin/amenity-picker-f{,-unit,-locked}.html` (befagyasztott kontraktus)
- `_planning/DECISIONS.md` (ADR-0072, ADR-0074)

## Nyitott

- ⛔ **Élesre SEMMI a teljes lokál teszt előtt** (tulaj-rendelet, 2026-08-27). Az éles `a8304ee`-n
  áll, a main jóval előrébb. A §C link-kapu javítása sincs kint — **de élesen nem is sül el**
  (ott a `PUBLIC_BASE_URL` a valódi domain, nem `.ts.net`); a lyuk a LOKÁL kiküldést fojtotta.
- **Három driftelt élő tenant** visszamenőleges rendezése (Villa Suzy 10, Nyugalom 12, Aszfalt
  `multilang`) — a kód a következő fizetésnél rendezi, a visszamenőleges javítás tulaj-döntés.
- **A `Nyugalom Vendégház` rendelés NÉLKÜL élesedett** — az élesítésnek is kapunak kellene lennie,
  nem csak a modul-készletnek (ADR-0072 nyitott ③).
- A katalógus bővítése tulaj-kérésre (additív).
- A lokál teszt-kör ajánlott pontjai: felszereltség szállás+szoba · ÚJ mock generálása (a régi
  mockokon az ikon nem jelenik meg, statikus fájlok) · modul be/ki + fizetés · outreach kiküldés.
  ⚠️ A lokál `.env` VALÓDI levelet küld.
