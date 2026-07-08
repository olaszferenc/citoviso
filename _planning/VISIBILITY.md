# VISIBILITY — Felfedezhetőség-motor + retention-modell

Dátum: 2026-07-07 · Státusz: terv-vázlat (a 2026-07-07 session gondolkodásának rögzítése)

> **Alapelv:** a fő ígéretünk a LÁTHATÓSÁG, de **egy honlap önmagában ma NEM hoz megkeresést** —
> szükséges, de nem elegendő. A termék valójában: *„honlapot generál ÉS felfedezhetővé teszi"*.
> Ez egy külön, automatizálandó **felfedezhetőség-motor**, és mivel az automatizálhatóság (A1) a fő
> értékajánlatunk, ennek is automatizáltnak kell lennie. Célszegmens: 2026-ban honlap nélküli,
> digitálisan éretlen szereplők → **ne várjunk tőlük kooperációt**; „mi tesszük láthatóvá".

---

## 1. Két csatorna-osztály

### A) „MI-IRÁNYÍTJUK" — nulla kooperáció, teljesen automatizálható (ide tesszük a fő ígéretet)
- **SEO-optimális honlap** — technikai SEO (sebesség, mobil, sitemap, HTTPS, canonical) +
  **Schema.org LocalBusiness/Hotel/Restaurant JSON-LD** (a strukturált lead-adatból egyenesen) +
  lokál kulcsszavak. ⭐ A generátor **alapból** ezt gyártsa (generátor-követelmény).
- **Indexelés** — a site a **mi domainünkön / Search Console-unkon** → a verifikáció MIénk. Auto.
- **Citations / NAP-konzisztencia** — cégnév/cím/telefon egységesen sok katalógusba (a portálok,
  amiket amúgy is scrape-elünk). ⭐ Ez a **claim NÉLKÜLI Maps-listát is feljebb rangsorolja** (erősíti
  az entitást a Google szemében) — kooperáció nélkül.
- **Rang-követés mint BIZONYÍTÉK/KPI** — kulcsszó+geo lekérdezésével kívülről mérjük, hol jelenik
  meg. **Nem kell az ő GBP-analyticsük** — a láthatóság-emelkedést saját méréssel igazoljuk.

### B) „SZEMÉLYAZONOSSÁG-KAPUZOTT" — Google Business Profile (GBP)
Fél-automata (lásd 2. pont). A GBP a magas értékű, de kapuzott ráadás.

## 2. GBP — a korrigált, valóság-alapú modell (2026)

- **Harmadik-fél (agency) menedzsment hivatalos és ToS-konform.** Szerep: **Manager vagy Owner**;
  a tulaj **mindig megtartja a Primary Ownert** (mi sosem kapjuk). 48 órán belül értesíteni kell a
  klienst a változásról; kérésre azonnal vissza kell adni a hozzáférést, különben Google-felfüggesztés.
- **A verifikáció a LÁTHATÓSÁG feltétele** — a **nem-verifikált** listát a Google gyakorlatilag
  **nem mutatja** a Maps/keresés találatokban. Tehát „látszik a Mapsen" ≈ „verifikálva van".
- ⭐ **A verifikációt a fizikai céghez köti, DE a DOER lehet az agency.** Ezért tudta a tulaj Mineral-
  listáját egy ügynök felállítani úgy, hogy a **tulaj „nem csinált semmit"** — ez a mi modellünk élő
  proof-of-concept-je. A kulcs nem „tulaj-kooperáció", hanem „a céghez kötött, Google-elfogadott jel".
- **Verifikáció-spektrum (a Google választ, nem mi):**
  - **Telefon / SMS kód** — a cég számára; ha az ügynök hozzáfér a kódhoz → ~0 tulaj-lépés. (legkönnyebb)
  - **Postai kód** — a cég címére; valaki felolvassa.
  - **Videó** — a *legújabb, 2026-ban új/kockázatos listáknál erőltetett*: egyetlen, megszakítás nélküli
    **helyben, appon át felvett** mobilvideó (utcatábla + cégnév a kinti táblán + fizikai hozzáférés);
    máshol felvett videó = elutasítva. Ez a **legrosszabb eset, az egyetlen visszafordíthatatlan tulaj-lépés.**
- ⛔ **Nem lehet megkerülni/hamisítani** (ToS + jog + pont az A4 bizalmi-alapkövünk ellen).
- **Fél-automata flow:** (1) auto-előkészítés (optimalizált profil, claim/access kezdeményezés) →
  (2) auto-értesítés a tulajnak idiótabiztos, 5 lépéses útmutatóval → (3) az EGYETLEN tulaj-lépés
  (SMS-kód felolvasás / rosszabb esetben 2 perces videó) → (4) auto-pollozzuk a státuszt → (5) hozzáférés
  után **API-ról teljes auto** kezelés (posztok, nyitvatartás, fotók, vélemény-válasz).
- **Analytics:** Manager-hozzáférés után **Performance API** (megtekintés, hívás, útvonal-kérés) auto;
  előtte **külső rang-követés** proxyként.
- ⚠️ **Skálázási korlátok:** a Business Profile API nem nyílt (formális jóváhagyás + **60+ napja
  verifikált** GBP + valós website kell; egy projekt/cég; bulk location-groupokkal). **Anti-spam:** túl
  sok verifikáció egyszerre → spam-flag → **ütemezni** kell az onboardingot.
- **Biztonsági mellékszál:** „Request Access" flow → a tulajnak **3 nap** válaszolni, utána átvehető;
  botok is kérnek hozzáférést idegen listákhoz — 3 napon belül reagálni kell.

## 3. Automatizálhatóság szerinti rétegzés (A1)

1. **Teljesen auto, a generátorba égetve:** technikai SEO + Schema.org + meta/title + sitemap.
2. **Auto, tulaj-hozzáféréssel (konverzió UTÁN):** GBP-kezelés, Search Console-indexelés.
3. **Fél-manuális / upsell:** tartalom-frissesség, GBP-posztok, citations/backlinks karbantartása.

## 4. Reális keretezés (fontos az ígéretnél)

Az SEO/láthatóság **időigényes és bizonytalan kimenetű** — nem azonnali, nem garantált #1 hely.
Az ígéret: a **kontrollálható emelőket** optimalizáljuk + technikailag felfedezhetővé tesszük —
NEM „garantált top találat". Az outreach-szöveg is eszerint fogalmazzon.

## 5. Retention-modell — a legélesebb üzleti pont

**A nagy érték (a láthatatlanból láthatóba ugrás) TARTÓS és az ügyfélé.** Ezt odaadtuk; ezen nem lehet
— és etikusan/Google-szabály szerint nem is szabad — „túszt tartani". Leltár, mit tudunk leállítani:

| Amit létrehozunk | Övé? | Vissza tudjuk venni? |
|---|---|---|
| GBP-optimalizálás (verifikált profil) | ✅ övé (Primary Owner) | ❌ NEM — csak a Manager-hozzáférésünk szűnik meg |
| Citations / NAP | ✅ nyilvános | ❌ NEM |
| SEO / elért rangsor | ✅ az ő domainjén | ❌ csak lassan erodálódik karbantartás nélkül |
| Honlap (statikus) | domain övé, hosting MIénk | ⚠️ részben — leállítható a kiszolgálás, de a HTML átvihető |
| **Dinamikus funkció** (foglalás, admin/CMS) | a MI infránkon fut | ✅ **IGEN** — leállítható, nem pótolható |

**Következtetés — a retention NEM túsztartás, hanem folyamatos érték, ami MEGÁLL, ha nem fizet:**
1. ⭐ **ERŐS lever — dinamikus FOGLALÁS a mi infránkon.** Kilépés = visszaesés az OTA-jutalékra →
   havonta mérhető ROI, egyetlen kapcsolóval leáll. **EZ a valódi retention-motor** (a „jutalék-kiváltás"
   nemcsak horog, hanem a **churn-költség** is).
2. **PUHA, de valós lever — a szegmens nem tartja fenn magától.** A célügyfél övé a GBP/site, de
   **nem karbantartja** → nélkülünk **elhervad**. Nem elvesszük — hanem elhervad. Ez a szegmensnél védhető.

**Architektúra-következmény:** az előfizetés **NE egyszeri eszközt kapuzzon, hanem FOLYAMATOS funkciót**
(dinamikus szigetek). A moduláris/dinamikus-sziget architektúra tehát **nem csak technikai döntés — ez a
retention-mechanizmus.**

**Újrakeretezés:** az **egyszeri láthatóvá tétel = a HOROG / akvizíciós költség** (elfogadjuk, hogy
odaadjuk). A **termék maga a folyamatos szolgáltatás** (foglalás + karbantartott láthatóság + „mi
csináljuk helyetted, örökre"). A margin a kapcsolatból jön, nem az egyszeri építésből.

## 6. Megvehető elemek (részletek: BACKLOG „MODULOK vs. SERVICE-ek")

- **MODULOK** = Site-funkciók a mi infránkon (foglalás, fizetés, menü, galéria) — **leállíthatók → retention**.
- **SERVICE-ek** = általunk nyújtott szolgáltatások (fotó, szövegírás, **GBP/láthatóság-kezelés**, kampány)
  — egyszeri vagy recurring. A GBP-kezelés és a folyamatos SEO/rang-riport tipikusan **recurring service**.

## 7. Hol illik a folyamatba (réteges modell)

- **Operatív / Termék:** SEO-optimális generálás (1. réteg, teljesen auto) — a mock már eleve felfedezhető-kész.
- **Onboarding (konverzió UTÁN):** a **GBP-alfolyamat = aszinkron állapotgép** emberi kapuval + külső
  várakozással (Google-review akár 5 nap) + újrapróba. Saját triggerek: `GBP-verifikáció-kérve`,
  `GBP-hozzáférés-megvan`. Kilóg a lineáris tölcsérből — külön modellezni.
- **Életciklus:** folyamatos optimalizálás + havi rang-riport = a **recurring érték** (retention).
- ⭐ Nyitott keret: a **láthatóság a scraper + generátor + A4 mellé egy NEGYEDIK önálló motor** („láthatóság-
  motor"), mert saját logikája/állapotai/folyamata van, ami átível Onboarding + Életciklus rétegeken.

## 8. Pre- vs. post-konverzió (a horog-határ)

- **Konverzió ELŐTT (nulla kooperáció, lehet horog):** SEO-optimális mock + **rang-alapmérés** →
  „most sehol nem jelensz meg; ezzel az oldallal ez megváltozna". A láthatóság-hiány *megmutatása* is meggyőz.
- **Konverzió UTÁN (fizetős):** GBP-claim, indexelés a saját domainen, citations, folyamatos kezelés.
- **Nyitott kérdés:** mennyi „ízelítőt" adunk a horogba anélkül, hogy az egész értéket ingyen odaadnánk?

## 9. Nyitott döntések

1. A generátor SEO-követelmény-listájának véglegesítése (mi a kötelező „by default").
2. Rang-követő megoldás (saját lekérdezés vs. szolgáltató) + a KPI-definíció.
3. GBP-onboarding ütemezés (anti-spam) és a 60-napos API-rámpa kezelése.
4. A horog-határ (mennyi láthatóság-ízelítő fizetés előtt).
5. A „láthatóság-motor" mint önálló komponens formalizálása (DOMAIN/architektúra).

## Források (GBP-kutatás, 2026-07-07)

- Business Profile third-party policies — Google: support.google.com/business/answer/7353941
- Overview for agencies — Google: support.google.com/business/answer/9199701
- Verify with a video recording — Google: support.google.com/business/answer/14271705
- Add or claim your Business Profile — Google: support.google.com/business/answer/2911778
- Verified vs unverified listings — rankinglocalmaps.com
- GBP API access guide for agencies — localith.ai
