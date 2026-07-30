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
- **Hatókör (MÓDOSÍTVA 2026-07-30, tulaj-döntés): a TELJES loop** — megkereséstől az
  élesített oldalig, **valós fizetéssel (Barion éles) és automata számlázással (Számlázz
  Agent éles) együtt**. A korábbi „order-intent-ig, beszedés másodlagos" szűkítés HATÁLYON
  KÍVÜL; az 5. pont fallbackje csak vész-tartalék marad.
- **Jogi forma (ELDŐLT 2026-07-30): egyéni vállalkozás.** A Mineral-híd (régi 5. pont)
  okafogyott — a Barion- és Számlázz-fiók az egyéni vállalkozásra nyílik; AAM-küszöb
  (20M Ft, 2026) bőven elég a pilothoz.
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

## 5. Számlázás — ~~Mineral-híd~~ → EGYÉNI VÁLLALKOZÁS (2026-07-30) + fallback

> **✅ MEGHALADVA (2026-07-30, tulaj):** a jogi forma **egyéni vállalkozás** — a Mineral-híd
> és a TEÁOR-fenntartások okafogyottak. A fallback-elv (ár-validáció ≠ beszedés) vész-tartalékként
> érvényes marad, de a pilot hatóköre a TELJES loop valós fizetéssel (lásd §1).

**Régi híd-terv (történeti):** a pilot-számlázást a meglévő cégen (**Mineral**) keresztül oldjuk meg → nem kell
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

## 7b. Kiküldés-előtti KAPU (2026-07-28 — jog/provenance-őr FLAG-jei + szöveg-kapu)

Az outreach-gerinc megépült (követett /p/ link + instrumentáció + §C-kapuzott email-piszkozat +
/adatvedelem oldal). Az ELSŐ éles kiküldés előtt KÖTELEZŐ (a determinisztikus §C-kapu addig FLAG-el):
1. **Publikus HTTPS `PUBLIC_BASE_URL`** — a Tailscale-IP (100.x) a címzettnek halott link (a kapu fogja).
2. **`OUTREACH_SENDER_*` valós adatokkal** — valós, monitorozott postafiók; a tényleges From-mal konzisztens.
3. **Szöveg-kapu a tulajjal:** email-szöveg + /p/ prospect-szövegek + /adatvedelem tájékoztató
   (megőrzési idő!) + VALÓS ÁRAK (`src/modules.ts` placeholder-ek cseréje — a H5 ár-jel ettől igaz).
4. Kézi küldésnél a From-cím = az aláírásban szereplő cím (különben C4-félrevezető feladó).

## 7c. Fizetés + számlázás ÉLESÍTÉSE (állás: 2026-07-29 — sandbox-validált, éles bevezetés NINCS)

**Tény:** a Barion-kör sandboxban teljes egészében lefutott (2026-07-21: teszt-kártya → PAID → site LIVE →
Számlázz TESZT-fiókos AAM-számla `OV-2026-2`), de a `.env` ma is teszt-állapotú: `BARION_URL=api.test.barion.com`
(sandbox POSKey), `INVOICE_PROVIDER=mock`. Az adapterek interfész mögött → az élesítés kulcs/env-csere.

**Éles kapcsoláshoz szükséges (sorrendben):**
1. ~~Cég-döntés~~ **✅ ELDŐLT (2026-07-30): egyéni vállalkozás** szerződik és számláz.
   A Mineral-híd + TEÁOR-csekk okafogyott; az ev. tevékenységi körében legyen benne a
   webes szolgáltatás (ÖVTJ-kód — tulaj ellenőrzi).
2. **Barion éles fiók** (céges KYC + bankszámla) → éles shop létrehozás + submit/approve → **éles POSKey**.
   Env-csere: `BARION_URL=https://api.barion.com` · `BARION_PAY_URL=https://secure.barion.com` ·
   `BARION_POSKEY=<éles>` · `BARION_PAYEE=<éles fiók>`. Plusz: **MIT/változó-összegű recurring** külön
   Barion-jóváhagyás (a megújításhoz; a pilot per-ciklus pay-linkkel enélkül is megy).
3. **Webhook publikus URL-en** (`/pay/webhook/barion`) — összeér a HOSZTING-döntéssel; amíg nincs,
   a `GetPaymentState` polling a fallback (a sandbox-kör is így futott).
4. **Számlázz.hu éles fiók + Számla Agent kulcs** → `SZAMLAZZ_AGENT_KEY=<éles>` + `INVOICE_PROVIDER=szamlazz`.
   AAM-küszöb 2026: 20M Ft — pilot-volumen mellett bőven belül.
5. **Éles füst-teszt kis összeggel** (saját kártya, azonnali sztornó/jóváírás) az első valós vevő előtt.

**⚠️ Pilot-scope emlékeztető (§1):** a pilot elsődleges terméke az order-intent-ig mért viselkedés — az
ELSŐ KIKÜLDÉST a fizetés-élesítés NEM blokkolja (fallback §5: „bent vagy, induláskor számlázunk").
A fizetés-élesítés a konverzió-lezáráshoz kell, párhuzamosan intézhető a kiküldéssel.

## 7d. INDULÁSI FELÜLET-LELTÁR (2026-07-30, tulaj-visszajelzés: „még messze vagyunk")

A folyamatot biztosító felületek állása őszintén — a pilot-indulás ezek „fixált" állapotát igényli:

| Felület | Ma van | Hiányzik a „fixált"-hoz |
|---|---|---|
| **1. Belső UI (scrape→mock→validáció)** | Konzol :4600 — lead-lista+szűrők, lead-lap, mock-generálás gombra, kuráció (approve/reject), prospect/outreach-panel, order/payment nézet, konverzió | Scrape-indítás+követés a felületről (ma CLI); batch-műveletek; pilot-tölcsér/riport nézet (H1–H5 + szegmens-bontás); a kurációs munkafolyamat véglegesített ergonómiája |
| **2. Email — kinézet + felület** | Szöveges piszkozat §C-kapuval, kézi copy-paste küldés (A2) | **HTML email-sablon** (márkás, mobil-helyes kinézet); **küldő-pipeline** (SMTP + suppression-lista betartása + §C DEFERRED kapu aktiválása + kiküldés a konzolból); külön küldő-domain SPF/DKIM/DMARC (§C.9 — a domain-döntés után) |
| **3. Tenant-admin felület** | Csak READ-ONLY token-oldal (modul-lista) | Önkiszolgáló SZERKESZTÉS (§E.12 support-minimalizálás): kép-csere/feltöltés, szöveg-szerkesztés, modul-kezelés; recept-szerkesztő (ADR-0016 ⑤); jogi önnyilatkozat-flow a demó-képek élesítéséhez (§A) |
| **4. Citoviso alap honlap** | NINCS (csak a konzol /adatvedelem oldala) | citoviso.com főoldal: mi ez, kiknek, referencia/minta, kapcsolat, ÁSZF + adatvédelem; a levélben linkelt előnézet mögötti BIZALOM-horgony. Ajánlás: a SAJÁT MOTORRAL generálva (dogfooding = élő bizonyíték) |

**Külső előfeltételek (tulaj):** domain (citoviso.com) · hoszting-döntés · Barion éles fiók (ev.) ·
Számlázz éles Agent-kulcs (ev.) · ÖVTJ-kör csekk · küldő-domain/postafiók.

**Javasolt építési sorrend (egy szál egyszerre):** ① Citoviso alap honlap (a domain/hoszting élesítés
természetes első terhelése + bizalom-horgony) → ② email HTML-sablon + küldő-pipeline (§C DEFERRED kapu
aktiválás) → ③ belső UI fixálás (scrape a felületről + tölcsér-riport) → ④ tenant-admin szerkesztő.
A fizetés/számlázás éles kapcsolása (§7c) a kulcsok megléte után bármikor beékelhető (env-csere + füst-teszt).

## 8. Nyitott döntések (a pilot indítása előtt)

1. **Batch-méret** — mennyi az „értelmezhető nagyságú" első kör (jel vs. kézi kezelhetőség vs. spam-kockázat)?
2. **Ár** — a teljes ár, amin az order-intent fut (a H5 küszöbhöz).
3. **Modul-készlet a konfigurátorban** — mely modulok legyenek próbálhatók (foglalás + ?).
4. **Küszöb-kalibráció** — a 4. pont H1–H5 számai.
5. **Mineral-TEÁOR** — a könyvelői zöld jelzés a számlázhatóságra.
