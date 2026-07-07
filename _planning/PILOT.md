# PILOT — Instrumentált tanuló-pilot (a megrendelésig)

Dátum: 2026-07-07 · Státusz: JÓVÁHAGYOTT terv-vázlat (a build ehhez igazodik)

> **A pilot fő terméke NEM a bevétel, hanem a VISELKEDÉSI ADAT.** Ez tanuló-kísérlet:
> a legkockázatosabb feltevéseinket teszteljük élő piacon, méréssel — nem „próbaeladás".
> Több külső visszajelzés közös metszéspontja: most a tesztelésnél tartunk; menjen végig
> a folyamat a **megrendelésig**, és élesen, mérve nézzük a piac reakcióját.

---

## 1. Cél és hatókör

- **Cél:** egy értelmezhető méretű, valós megkeresés-batch → a piac éles reakciója,
  végig **műszerezve** (ki, milyen státuszú, mit csinált, meddig jutott).
- **Hatókör:** a teljes teszt-flow a **megrendelés-szándékig** (order-intent). A tényleges
  pénz beszedése másodlagos és a cég-kérdésre gatezelt (lásd 5. pont).
- **Iparág/piac:** az első pilot-vertikum (szállás), teszt-régió (Balaton) — de a mérés
  szegmentálva, hogy a tézisek iparág-függetlenül is tanulságosak legyenek.

## 2. A teszt-flow állomásai

1. **Scrape** — valós, friss leadek egy régióból (élő, nem replay).
2. **Kvalifikáció + szegmens-címke** — minden leadre: `nincs_honlap` / `0_lábnyom` /
   `van_lábnyom` / `elavult_oldal` (ez a szegmens-hipotézis alapja).
3. **Mock-generálás + kuráció-gate** (A2 nulladik pont).
4. **Hosztolt, INSTRUMENTÁLT preview + konfigurátor** — a vevő megnyitja, modulokat
   ad hozzá/vesz le, „élő próbatér". Minden interakció eseményként rögzül.
5. **Megkeresés (outreach)** — perszonalizált, GDPR-tudatos, leiratkozható; egyedi,
   követhető linkkel (ki nyitotta/kattintott).
6. **Order-intent** — a valós megrendelés-flow **teljes áron** (a tiszta ár-jelért).

## 3. Esemény-taxonómia (mit mérünk — hipotézishez kötve)

| Réteg | Mit mérünk | Melyik hipotézist teszteli |
|---|---|---|
| **Akvizíció** | ki kattintott, mennyi idő alatt (open/click) | a horog ereje |
| **Engagement** | hány visszatérés, session-hossz, görgetés-mélység, mit nézett | tényleg megfogja-e |
| **Visszatérés-kadencia** | idő a visszatérések közt, mit csinált újra | mennyire „rágódik" rajta |
| **⭐ Konfigurátor-szándék** | mely modulokat adott hozzá/vett le, mit próbált, **de nem vett** | mi vonz + hol a fizetési súrlódás |
| **Konverzió** | hol esett ki (nézte → konfigurálta → order-intent → elhagyta) | a tölcsér szűkülete |
| **⭐ Szegmentáció** | user-státusz (nincs honlap / 0 lábnyom / van lábnyom / elavult) | **a „nincs semmije = legjobb szegmens" tézis** |

⭐ A két legfontosabb: a **konfigurátor-szándék** (hozzáadott modul ≠ vásárlás = tiszta
érdeklődés-jel) és a **szegmens-szerinti konverzió** (a fő stratégiai feltevés tesztje).

## 4. Hipotézisek + siker/kudarc küszöbök (KALIBRÁLANDÓ indulás előtt)

Placeholder-küszöbök, hogy a pilot kísérlet legyen, ne adathalom — indulás előtt kalibráljuk:
- **H1 (horog):** a mockos megkeresés átkattintási aránya érdemben magasabb, mint egy sima
  ajánlaté. Cél: átkattintás > ~15%.
- **H2 (engagement):** a kattintók > ~30%-a visszatér legalább egyszer.
- **H3 (konfigurátor):** a látogatók > ~20%-a hozzáad legalább egy modult.
- **H4 (szegmens):** a `nincs_honlap`/`0_lábnyom` szegmens order-intent aránya **magasabb**,
  mint a `van_lábnyom`/`elavult` szegmensé (ez validálná a fő tézist).
- **H5 (konverzió):** order-intent (teljes áron) > ~3–5% a megkeresettekre vetítve.

## 5. Számlázás — Mineral-híd + fallback

**Híd:** a pilot-számlázást a meglévő cégen (**Mineral**) keresztül oldjuk meg → nem kell
most új céget alapítani. ⚠️ **Fenntartások:**
- **TEÁOR / tevékenységi kör:** a Mineral (logisztika) csak akkor számlázhat web/marketing
  szolgáltatást, ha a tevékenységi köre lefedi — könyvelővel 5 perc tisztázni (esetleg TEÁOR-bővítés).
- **Számla-tisztaság:** a vevő „Mineral"-tól kap számlát egy weboldalért — pilotban világos
  tétel-megnevezéssel rendben.

**Fallback (ha a számlázás időben nem megoldható) — a KULCS: ne keverd az ár-validációt a beszedéssel:**
- A megrendelés-flow **teljes áron** fusson → a valódi „igen" az **igazi árnál** = tiszta ár- és konverzió-jel.
- **UTÁNA**, a fizetés pillanatában add oda az engedményt mint **close/goodwill/halasztás** eszközt:
  „bent vagy, induláskor számlázunk / első hónap ingyen".
- ⚠️ Ne kínálj **eleve** 50% kedvezményt — az „igen 50%-ért" elrontja az ár-jelet. Az engedmény
  csak a YES UTÁN, beszedés-mechanikaként jön.

## 6. Jogi / GDPR

- Outreach: perszonalizált, célzott, **leiratkozható** (nem tömeg-spam); Grt./GDPR-tudatos.
- Viselkedés-követés: a meghívott prospecten is kell **jogalap + tájékoztatás** (B2B jogos érdek
  védhető, de jelezni kell; süti/consent, ahol releváns).
- Provenance/A4: a mock CSAK verifikált párosításból; portál/vendég-fotó kizárólag demóra.

## 7. Amit ehhez építeni kell (a most kész adat-rétegre ül)

- A scraper/generátor átkötése az adat-rétegre (2. pillér).
- **Vevő-oldali instrumentált preview + konfigurátor** (élő próbatér) — esemény-tracking.
- **Új entitások (egyeztetendő, migrációban):** `prospect`/`user` (a megkeresett szereplő +
  státusz-címke), `mock_view`/`session`, `mock_event` (konfigurátor + engagement események),
  `order_intent`. — a mag-entitásokhoz (lead, mock_artifact) kötve.
- Outreach-küldés + követhető linkek (open/click).
- Order-intent flow (teljes áras megrendelés-rögzítés).

## 8. Nyitott döntések (a pilot indítása előtt)

1. **Batch-méret** — mennyi az „értelmezhető nagyságú" első kör (jel vs. kézi kezelhetőség vs. spam-kockázat)?
2. **Ár** — a teljes ár, amin az order-intent fut (a H5 küszöbhöz).
3. **Modul-készlet a konfigurátorban** — mely modulok legyenek próbálhatók (foglalás + ?).
4. **Küszöb-kalibráció** — a 4. pont H1–H5 számai.
5. **Mineral-TEÁOR** — a könyvelői zöld jelzés a számlázhatóságra.
