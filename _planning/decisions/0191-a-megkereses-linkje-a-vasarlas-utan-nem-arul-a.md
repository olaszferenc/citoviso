## ADR-0191 — A megkeresés linkje a VÁSÁRLÁS UTÁN nem árul: a lead saját oldalához vezet

**Dátum:** 2026-09-20 · **Státusz:** elfogadva · **Kiváltó:** tulajdonosi dev-teszt

### A tényállás

A tulaj dev-ben végigvitte a vásárlást, majd ÚJRA megnyitotta a kiküldött megkeresés
linkjét (`/p/<token>`). A lap ugyanúgy kiszolgálta a mockot, a konfigurátort és a
**valódi kártyaterhelést indító fizetés-lapot** — egy olyan leadnek, aki ugyanazon a
napon már fizetett (Aranykagyló 36, `initial` payment `paid` 12:52-kor).

A kár NEM „dupla vásárlás". Megmérve, mi történt volna a második fizetéssel:

| Lépés | Eredmény |
|---|---|
| `convertLead` (`provision.ts:196`) | idempotens a `lead_id`-ra → **nem hibázik**, nincs új tenant |
| `ensureSubscriptionForOrder` (`subscription.ts:108`) | `onConflict(tenant_id).doNothing()` → **a fordulónap NEM tolódik** |
| `issueAndSendTenantLogin` (`service.ts:983`) | `existingLogin` ág → **nincs új hozzáférés** |
| `issueInvoice` (`service.ts:787`) | **valódi számla áll ki** |

Vagyis a vevő fizet, számlát kap, és **cserébe semmit nem kap — még hosszabb
előfizetést sem**. Ez nem kényelmi hiba: díjszedés ellenszolgáltatás nélkül,
számlával dokumentálva.

### A döntés

**① A tiltás a PÉNZ-ÚTON ül, nem a képernyőn.** `requestPayment()` `kind === "initial"`
esetén megtagadja a pay-linket, ha a leadhez tartozik tenant VAGY fizetett `initial`
rendelés. Nincs pay-link ⇒ nem lehet terhelés. A képernyő csak ezután számít: egy
régen nyitva hagyott fül újraküldheti az űrlapot, tehát egy gombot elrejtő felület
NEM kapu. `handleOrderRequest` ugyanezt a kaput a rendelés RÖGZÍTÉSE ELŐTT futtatja,
különben egy `order_intent` + operátori riasztás keletkezne egy nem-problémából.

**② EGY predikátum, két hívó.** `ownedSiteForLead()` (`src/conversion/owned.ts`) a
képernyő és a pénz-út KÖZÖS forrása. Egy saját szabályból számolt jelvény az, amitől
a felület „megvehető"-t mutat, miközben a művelet elutasít (ADR-0135 tanulsága).

**③ A predikátum KÉT lába van, és a második a fontosabb.** Tenant VAGY fizetett
`initial`. Amikor az aktiválás megtagad (hiányzó fotó-jog nyilatkozat, nem jóváhagyott
piac, sikertelen live render — mind létező ág a `service.ts`-ben), a vevő FIZETETT és
NINCS oldala. Pont ekkor nyitja meg újra a levelet. Egy csak-tenant vizsgálat ezt a
vevőt engedné át a második terhelésre.

**④ A lap HARMADIK keretezési állapotot kap (`owned`), saját sávval ÉS saját lábléccel.**
Nem újrahasznosítható egyik meglévő pár sem, mert mindkettő valótlant állítana egy
fizető ügyfélnek: a követett sáv úgy végződik, hogy „**Ez még nem élő oldal.**", a
követett lábléc pedig azt, hogy mérünk, „hogy az **ajánlatot az igényeihez
igazíthassuk**". §B.17 ránk is áll. Az `owned` ág kihagyja a `recordView`-t, az
event-beacont, az eszkalációs ajánlatot és a konfigurátort — és a lábléce ezért
mondhatja, hogy nem mérünk.

**⑤ A sáv ELVEZET a belépéshez, de NEM léptet be.** A link e-mailben utazik; egy
továbbküldött levél különben fiók-hozzáférés lenne. A cél a kanonikus
`TENANT_LOGIN_URL` (`server/ownerLogin.ts:15`) — ⛔ NEM `siteUrl + "/login"`: mérve
az a cím úgyis 302-vel ide dob (`public.ts:949`), tehát saját másolat lett volna egy
meglévő szabályból.

**⑥ Három állapot, három igaz mondat.** `live` → „Ez az oldal már az Öné", a címmel;
`provisioned` → elkészült, a nyilvános megjelenés folyamatban; `paid_pending` → a
fizetés beérkezett, az oldal készül. Egy magabiztos „az oldala él" a megakadt
aktiválású vevőt tévesztené meg a legjobban.

### Amit a megvalósítás közben MÉRTÜNK (mind saját hiba volt)

- A „nincs vásárlási hívás" első állításom a `Megrendel` szóra illeszkedett, és a
  SAJÁT sávom szövegére („Megrendelve: …") ment pirosra egy hibátlan lapon. Azóta a
  konfigurátor VALÓDI horgonyára (`data-cit-configurator`) köt, negatív kontrollal.
- A `position === "static"` állítás hamis pirosat adott az `aurora`-n
  (`body>*{position:relative}` — a sáv relatív lesz, de FOLYAMBAN marad). A mérce a
  geometria + `elementFromPoint`, ahogy a testvér-őrben.
- A §2b vázlat méret-váltója asztali módban csak a helyet töltötte ki, így a tulaj
  telefonján az asztali elrendezést SOHA nem mutatta volna meg. 1280 px-es viewport
  kicsinyítve — igazolva 390 px-en.
- A sáv `hostOf()`-fal írta ki a címet, ami a `/t/<slug>` dev-úton „az oldala él:
  100.97.188.105:4800"-at eredményezett — olyan cím, ahol az oldal NINCS.
- **A saját őrömnek KIMONDATLAN, MUNKAFA-FÜGGŐ előfeltétele volt**, és ez buktatta el a
  landolást: a `mock_artifact.path` egy PUSZTA FÁJLNÉV, amit a route a cwd-hez képest
  olvas, a fájl viszont a FŐ FA gyökerében fekszik — egy munkafában (és friss klónon)
  tehát nincs ott, a `/p/<token>` a 404-ágra fut, és az őr a TERMÉKET jelentette
  hibásnak a KÖRNYEZET helyett. Az őr most legyártja a hiányzó fájlt a saját fájában
  (a motorral) és a végén eltakarítja; a fő fához nem nyúl.
- **Az új kapu eltört egy IDEGEN őrt** (`market-gate-check`): a fixture-je a megújulás-ág
  miatt MINDJÁRT az elején tenantot hozott létre ugyanarra a leadre, így a három
  `initial` ág egy „már vásárolt" leaden futott, és az őr a PIAC-kapu helyett ezt a
  kaput mérte. A tenant azóta közvetlenül a megújulás-ág előtt születik — az őr
  mindkét állítása visszakapta a saját alanyát.

### Őr

`scripts/prospect-owned-check.mts` — a VALÓDI `requestPayment()`-et futtatja egy
valódi, már vásárolt lead `initial` rendelésére (mellékhatás-mentes: a kapu minden
írás előtt áll), a predikátum MINDKÉT polaritását méri, és a felületen tiltja
névszerint a két mondatot, ami itt hazugság lenne. Önteszt: a beültetett hibákra
12 piros. Az ÉLES útvonalat is méri: a lap kimegy (200), nincs rajta vásárlási réteg,
a `mock_view` NEM nő (tehát a lábléc „nem rögzítjük" mondata igaz), és az elutasított
rendelés után az `order_intent` darabszáma változatlan (nincs riasztás egy
nem-problémából). ⛔ Kimondva NEM fedi: hogy egy NEM vásárolt lead tényleg KAP-e
pay-linket — az valódi `payment` sort írna a közös dev-adatbázisba.
