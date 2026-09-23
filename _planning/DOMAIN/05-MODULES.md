# 05 — MODULOK (szállás pilot)

> **Mi ez?** A modul = a generált oldal FUNKCIÓ-tengelye (mit tud/mutat az oldal), szemben az
> archetípussal (forma), tierrel (tónus) és környezettel (paletta). A modul **adat, nem korpusz-tengely**:
> az archetípus egy modul-BEFOGADÓ elrendezés-nyelvtan, a modulok jelenlét/hiány-tűrő blokkok, amelyek
> az archetípus skinjét felöltve rendeződnek el (CLAUDE.md §7: „közös mag + adat-objektum"). Ez a
> szállás-iparág **interfészének** implementációja a 3 becsatlakozási ponton (KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ).
> Kapcsolódó: DECISIONS ADR-0009/0010, DESIGN-CATALOG §6, `src/generator/corpus.ts` + `mockFromCorpus.ts`.

⚠️ **Szándékos mélység-korlát (ADR-0010).** Most CSAK Szint 0–1 (katalógus + megjelenési jel) — ennyit
fogyaszt a korpusz-prompt (mit rendezzen) és a grounding (mit tölt / mit hagy ki). **Később** (data-plane/
konverzió): Szint 2 adat-séma · Szint 3 entitlement-kapuzás (ingyen-mock vs fizetős élő) · Szint 4 működő widget.

---

## Szállás modul-katalógus (Szint 0–1)

Jelölés: **[SPINE]** = mindig jelen (archetípustól függetlenül) · **[DATA]** = csak valós adatra jelenik meg,
hiányában KIHAGYVA (sosem fabrikálva — ADR-0007/0009 tényhűség) · **[UPSELL]** = később entitlement-kapuzott.

### KÍNÁLAT (mit ad a szállás)
| Modul | Cél | Megjelenési jel | Jelleg |
|---|---|---|---|
| `gallery` | Valós fotók bemutatása (az archetípus rendezi: bento/mozaik/carousel) | van ≥1 valós fotó | [DATA] (gyakorlatilag spine, ha van kép) |
| `rooms` | Szobák/apartmanok | van valós szoba-név/típus | [DATA] |
| `amenities` | Felszereltség/szolgáltatás | képen látható v. adatban szereplő, RELEVÁNS felszereltség | [DATA] |
| `pricing` | Árak/szezonok | van valós ár | [DATA] (nincs ár → nincs áras szekció) |

### ELÉRHETŐSÉG (hogyan érem el / foglalok)
| Modul | Cél | Megjelenési jel | Jelleg |
|---|---|---|---|
| `enquiry` | Kapcsolat/érdeklődés-CTA — a biztonságos konverziós út | mindig | **[SPINE]** |
| `contact_details` | Telefon/email/cím — csak a megadott valósat | van valós elérhetőség | [DATA] |
| `location` | Térkép + megközelítés/útvonal | van koordináta/cím | [DATA] |
| `booking` | Tényleges szállásfoglalás (widget/kérés) | — | [UPSELL] (mockban legfeljebb `enquiry`-ként) |
| `hours` | Beköltözés/kijelentkezés, nyitvatartás | van valós adat | [DATA] |

### KONVERZIÓ (miért pont ez a szállás)
| Modul | Cél | Megjelenési jel | Jelleg |
|---|---|---|---|
| `usp` | „Miért mi" — valós megkülönböztető előnyök (turisztikailag releváns) | van valós, releváns megkülönböztető tény | [DATA] |
| `reviews` | Valós vélemények (Google — enrichment) | van valós vélemény | [DATA] (kamu értékelés TILOS) |
| `poi` | Környék/látnivalók, közelség | régió-kontextus / POI-enrichment | [DATA] |
| `newsletter` | Ajánlatkérés/hírlevél-CTA | opcionális CTA | [UPSELL] |

**Gerinc (mindig):** `hero` (az archetípus nyitánya, nem külön modul) + `enquiry` + lábléc-provenance.
Minden más **adat-kapuzott**: van rá valós adat → megjelenik; nincs → kimarad. Ez a mock tényhűségének motorja.

> ⚠️ **A fenti három tábla GENERÁTOR-nézet, nem az eladható katalógus** — és 2026-09-21-én mérve
> **eltér** tőle. A `MODULE_CATALOG` (`src/modules.ts`) a modul-igazság forrása; eltérésnél a kód nyer
> (04-INDEX „Karbantartás"). A mért eltérések: `contact_details` **nem létezik** a kódban (nulla találat)
> · `email` és `multilang` **hiányzik** innen (utóbbi az egyetlen `billing:"once"`, `tenantOnly`) ·
> a `newsletter` **le van véve a polcról** (`retired: true`, 2026-09-14 — az űrlap nem létező végpontra
> POST-olt) · a `booking` sora („mockban legfeljebb `enquiry`-ként") elavult: az ADR-0061 óta a mock
> booking-slotja **kipróbálható demó-widget**. Ellenőrző parancs:
> `npx tsx -e 'import {MODULE_CATALOG} from "./src/modules.ts"; …'`

---

## Modul-függőségi rend (Szint 2–3 előszoba — ADR-0192)

A modulok nem független kapcsolók: a katalógus **három szereposztási tengelyen** köti őket egymáshoz.
A fenti „jelenlét/hiány-tűrő blokk" elv a RENDERELÉSRE továbbra is igaz (üres sáv sehol nem keletkezik,
minden blokk korai return-nel véd) — **a kár nem üres sáv, hanem kontextus nélküli tartalom**.

### A három relációtípus

| Típus | Jelentés | Hol dől el | Példa |
|---|---|---|---|
| **kiváltás** (`supersedes`) | egy SLOT, két állapot — sosem mindkettő | render + árazás (`supersederOf`) | `booking` kiváltja az `enquiry`-t |
| **függőség** (`requires`) | enélkül a modul nem tud értelmes felületet adni | kosár + jogosultság-írás + lemondás | `booking → pricing → rooms` |
| **művelet-kapu** | nem a modul, hanem egy SZERKESZTŐ kér két jogosultságot | a művelet szintjén (ADR-0074 §5) | szobánkénti felszereltség = `rooms` + `amenities` |

⛔ **A harmadikat ne keverd a másodikkal.** Az `amenities` **site-szintű adat**
(`site_module_config('amenities').config.items`), `rooms` nélkül hibátlanul renderel — a kötés csak a
szobánkénti szerkesztőre áll. Katalógus-szintű `requires`-ként bevezetve hazuggá tenné a súgót is
(a szócikk címe: *„mit kap a vendég az egész szálláson"*).

### A lánc, és amiért a tulaj elfogadta

```
booking  ──requires──▶  pricing  ──requires──▶  rooms     (rooms: ha 2+ egység, VAGY ha ismeretlen)
```

**Ár nélküli foglalás nem foglalás** — a tulajnak kézzel kellene minden kérésre árat válaszolnia, ami a
support≈0 elv ellen hat. ⚠️ De a `booking` ár nélkül **nem törik el**: a foglalási kérés LÉTREJÖN, csak
`quoted_total` nélkül (`src/booking/requests.ts:402,425`) — a hiba tehát nem összeomlás, hanem hogy a
vendég **ár ismerete nélkül** vállal kötelezettséget.
A `rooms` viszont **egy-egységes szállásnál nem kötelező** (ADR-0059: ne adj el olyat, ami nem látszik) —
ott az „A szállás egésze" kártya nem rács.

### A feltétel kiértékelése — és ahol NEM értékelhető ki

A `when: "multiUnit"` kiértékelője az `isMultiUnit()` (`src/tenant/units.ts`). **Egy szabály, egy példány.**

⛔ **Mock fázisban a feltétel ~97%-ban kiértékelhetetlen** (2026-09-21, mérve): 33 mock-artifactból
**0**-ban van valódi szobalista, 1-ben `sampleRoomCount`; a prospectnek **szerkezetileg nincs**
`site_unit` sora (az `ensureUnits` lustán, a konverzió UTÁN fut). Ezért a szabály: **ismeretlen → a
függőség ÁLL**. Az indok nem óvatosság, hanem összhang — a mock maga **3 szobakártyát MUTAT**
(`sampleRooms()` → `SAMPLE_ROOMS.length`), tehát az „ismeretlen = egy egység" feltevés a KÉPERNYŐNEK
mondana ellent.
⛔⛔ **A lapon látható szobakártya-szám HAMIS PROXY** — aki a DOM-ból számolna, mindig „2+"-t mérne.

### Két invariáns, amit a felderítés fizetett meg

1. **A jogosultság nem elég feltétel.** Mérve: egy fiókban `booking` ÉS `pricing` is aktív, de **0 db
   `unit_price` sor** → a foglalás ma sem mond árat; 4 `pricing`-et fizető tenantból **3-nak nulla
   ár-sora van**. A modul-halmaz érvényessége és az ADAT megléte **két külön kérdés**.
2. **Az upsell-rendelés `modules` mezője DELTA, nem halmaz.** A függőséget a **beküldött halmaz ∪ a
   meglévő jogosultságok** unióján kell kiértékelni — aki a rendelés-sort önmagában nézi, **minden**
   upsell-rendelést elutasít, ami nem véletlenül vesz meg egy már birtokolt modult.

### Az ár IDEJE — ismétlődő és évhez kötött (ADR-0215, migráció 0072)

Egy `unit_price` sor két, egymástól független időtengelyt hordoz:
- `date_from`/`date_to` (**MM-DD**, év nélkül) — az ISMÉTLŐDŐ szezon, minden évben ugyanaz;
- `valid_from`/`valid_to` (**teljes dátum**) — az ÉVHEZ KÖTÖTT érvényesség. Mindkettő üres = időtlen.

Egy éjszakára a sorrend (egy helyen: `assets/runtime/cit-season.cjs`): **évhez kötött szezon →
ismétlődő szezon → dátumos alapár → időtlen alapár → nincs ár**. A „nincs ár" nem hiba, hanem
az árajánlat-út kiváltója (ADR-0208): a vendég nem kap számot, a tulaj ajánlatot küld, és az
ajánlat ára **mindig** az árlistába kerül (ADR-0215) — a hiányzó ár így nem ismétlődhet.
⛔ A dátumos sor lejárata nem csak szabály-kérdés: a lap statikus pillanatkép, tehát lejáratkor a
sor TÖRLŐDIK és a lap ÚJRARENDERELŐDIK (`src/tenant/priceExpiry.ts`, óránkénti tick).

### Ahol a halmaz EMBER NÉLKÜL sérülhet

A modul-halmaz nem csak kattintásra változik. Három sodródási út (ADR-0192 ⑦):
a **megújítás vak kikapcsolása** (`cancel_at_period_end` sweep — a lemondás pillanatában a halmaz még
érvényes, a fordulónapon már nem) · az **egység-törlés** (2-egységes site 1-egységessé válhat, és a
halmaz **utólag** lesz érvénytelen) · a **`module_sales_disabled` kapcsoló** (tranzitív eladhatatlanság:
a `pricing` letiltása a `booking`-ot is eladhatatlanná teszi).

## Következmények a motorra
- **Korpusz (agent-1):** az archetípus e modul-blokkokat rendezze el a maga egyedi szerkezetében; tervezzen
  úgy, hogy BÁRMELY részhalmaz szépen renderel (nincs üres/tört slot). A korpusz placeholder-tartalma minden
  modult megmutathat (cél-gazdagság), de a szerkezet legyen moduláris.
- **Grounding (agent-2):** a valós adatból modul-példányokat tölt; a [DATA]-modult csak akkor rendeli, ha
  van rá valós adat; a gerinc mindig ott van. Nincs fabrikáció, nincs üres szekció.
- **Nincs kombinatorikus robbanás:** a modul NEM szorozza a korpuszt (nem archetípus × modul-kombináció) —
  a modul-készlet a lead adat-objektumának része.
