# Fázis 4 — Vertikális MVP („walking skeleton") — ✅ KÉSZ

Dátum: 2026-07-05 (lezárva 2026-07-06)
Típus: tervezés (Fázis 4, lásd `_planning/ROADMAP.md`)
Státusz: 4a ✅ · 4b ✅ · 4c-i ✅ · 4c-ii ✅ · 4d ✅ — KÉSZ. Következő: Fázis 5 (éles pilot).
Cél: a legszűkebb, de teljes tölcsér-szelet — bizonyítani, hogy a gép működik, a legkisebb formában.

## Siker-kritérium
> Az automata scraper megtalálja a balatoni honlap nélküli szállásadókat → azokból automata mock →
> egy szállásadó **fizet** → **élő, foglalható oldala** lesz, amin egy **valós vendég foglalni tud**.

## 4a — Scope & piac ✅
- **Iparág: SZÁLLÁS.** Indok: a vendég ELŐRE tervez (szabad-e, van-e, mit foglaljak) — magasabb szintű,
  tervezést igénylő igény (szemben a vendéglátás ad hoc jellegével). → az Elérhetőség+Konverzió becsatlakozási pont
  itt a legértékesebb → az MVP rögtön a legnehezebb/legértékesebb részt validálja.
- **Piac: magyar / Balatoni régió — KIZÁRÓLAG teszteléshez.** Sok kicsi, honlap nélküli szereplő (jó a lánchoz).
  ⚠️ Tudatosan tesztpiac: a valódi volumen a nagy nyugati piacokon (FR/DE/US), de oda a jogi keret hiánya miatt csak Fázis 6.

## 4b — Az MVP-nek KÉT automata magja van
A rendszer két kulcs-motorja (a tulaj korrekciója): **a scraper (volumen-motor) legalább annyira fontos, mint a generátor (a termék).**
| Mag | MVP-ben | Bizonyítandó |
|-----|---------|--------------|
| **Scraper / lead-discovery** | automata, limitált scope | a volumen-motor működik kicsiben |
| **Generátor** | automata (mock → provisioning → élő Site + foglalás-sziget) | a termék-mag működik |
- **Automata mag** (bizonyítandó): mock-pipeline, provisioning, Site-render + foglalás-sziget, **ÉS a scraper**.
- **Kézi marad (A2, első kör):** csak a kuráció + esetleg a megkeresés-kiküldés. A lead-discovery már NEM kézi.

## 4c-i — Scraper / lead-discovery spec ✅
**Pipeline:** forrás-fésülés → entitás-kinyerés → **kvalifikáció** → dedup/normalizálás → lead-rekord (control plane).
**Kvalifikáció (a mag, AI-támogatott — „megtalál ÉS minősít"):**
- *Nincs saját honlap* (Maps-ben nincs website; vagy csak portál-link) → ✅ príma (nulláról)
- *Elavult honlap* (nem reszponzív, régi copyright/tech, vizuál-AI „elavult" pontszám) → ✅ jó (modernizálunk)
- *Modern honlap* → ❌ kizár

### ⭐ Fő felismerés: a scraper is Iparág × Ország paraméterezett
Melyik platformokon keresek + milyen súllyal minősítek = **Iparág × Ország** függvénye (a fogyasztók máshol keresnek
régiónként/iparáganként). Eszköz: **platform-regiszter** (a Iparág × Ország definíció része, control plane):
| Platform-típus | Példa | Kvalifikációs súly |
|----------------|-------|--------------------|
| Globális | Booking, Airbnb | jutalékot fizet, gyakran nincs saját jelenlét — erős jel |
| Lokális nagy | szállás.hu | régió-domináns, sok honlap nélküli |
| Helyi kicsi | balatonnyaralas.hu | niche, pontos régió-jel |

**Digitális lábnyom-profil (per lead):** feltérképezzük, mely platformokon van jelen (cím/név/elérhetőség-egyeztetéssel). Haszon:
(1) gazdagabb kvalifikáció + több adat/kép a mockhoz; (2) a megkeresés személyre szabása + jutalék-horog
(„látjuk, hogy a Bookingon vagy, ahol jutalékot fizetsz…").

**MVP:** fókusz a „nincs saját oldal" szegmensre; nem csak Maps (Maps + szállás.hu + globális portál-jelenlét); a magyar/balatoni platform-táj kézzel összeállítható. Jog: tudatos, limitált, provenance-jelölt gyűjtés (jogász bevonva).
> ⚠️ Fázis 6 zászlók: (1) minden új ország belépésekor a platform-táj feltérképezése kötelező (Ország-lokalizáció része); (2) források scraping-ellenállása (rate-limit/blokk/ToS) — skálán proxy/rate/jog.

## 4c-ii — Generátor-mag (vázlat, 1 nyitott döntés)
**A 3 becsatlakozási pont MVP-minimuma szállásra:**
| Pont | MVP-minimum | Kimarad (később) |
|------|-------------|------------------|
| Kínálat | 1–N szobatípus `{név, leírás, kapacitás, kép, alapár}`, statikus kártyák | csomagok, szezonális ár |
| Elérhetőség | egyszerű foglaltság-naptár (dátum→szabad/foglalt) szobatípusonként, tulaj állítja | channel-sync, min-éjszaka/szezonszabály |
| Konverzió | foglalási flow: szoba+dátum+létszám → Foglalás + elérhetőség-csökkenés + email-visszaigazolás | online előleg/fizetés, lemondás-politika |

**Árnyalat — mi valós, mi demó a mockban:** a Kínálat+bemutató valós (scraped: szobák, képek, leírás); az Elérhetőség
(valós foglaltság) NEM (tulaj belső adata) → a mockban a **tranzakciós mag DEMÓ**, és **élesítéskor válik valóssá** (tulaj tölti).

**Fizetés-scope az MVP-ben (ELFOGADVA):**
- Tenant→Citoviso (élesítés = 1. fizetős kapu): ✅ BENNE (a siker-kritérium ezen áll).
- Vendég→Tulaj (foglalási előleg): ✅ HALASZTVA → a foglalás egyelőre fizetés nélküli kérés (request→visszaigazolás).

## 4d — Megvalósítási / stack döntések ✅
**Vezérelv: „build vs. buy" — csak a differenciáló MAGOT építjük, a commodity-t készen vesszük.**

### Stack-alap (adott / a 3a-ból következik)
- Runtime: **Node.js 20+ / TypeScript (strict, ESM)** (a repó már ezen).
- DB: **PostgreSQL** — a 3a RLS-izolációja + JSONB rugalmas réteg pont Postgres-erősség. Egy DB az MVP-hez.
- Scraping-eszköz: **Playwright** (headless Chromium, telepítve).
- AI: **Claude API** (legújabb modellek) a mock-pipeline copy/vizuál + a scraper honlap-minősítéshez.

### Build vs. Buy
- **MI ÉPÍTJÜK (a mag, a mi IP-nk):** ⭐ **Scraper / lead-discovery** (forrás-fésülés, kvalifikáció, platform-regiszter, lábnyom-profil) · **Generátor** (mock-pipeline, provisioning, render) · **Iparág × Ország definíció-motor** · a control/data plane adatarchitektúra.
- **A scraper TÁMASZKODIK rá (commodity building block, de a logika a miénk):** Playwright (böngésző-hajtás = „kéz"), Claude API (minősítés = „szem").
- **Commodity, készen vesszük (SOSEM a két motor):** fizetés (Stripe-szerű), e-mail/SMS-kézbesítés (SPF/DKIM), domain-regisztráció (regisztrátor-API), LLM-hozzáférés (Claude API).
- ⚠️ Tisztázva: **a scrapert MI építjük** — ez a mag, nem „buy".

### Hosting (az „éles cél = TBD" feloldása MVP-re)
- **DÖNTÉS: managed felhő** az MVP-hez (gyors indulás, kevés üzemeltetés, skálázható): statikus váz → CDN/edge; dinamikus sziget + admin → backend; DB → managed Postgres.
- **Saját VPS/dedikált infra** (szigetelés-doktrína) → **Fázis 6**, amikor a volumen/költség/adatszuverenitás indokolja.

## Fázis 4 — összefoglaló
Az MVP egy **két-magos walking skeleton** (scraper + generátor, mindkettő automata, limitált scope) szállásra,
Balaton-teszten; managed felhőn, build-vs-buy elvvel. Siker = automata scrape → mock → egy fizet → élő foglalható oldal.

## Következő: Fázis 5 (éles pilot)
Valós lead → megkeresés → fizetés → élő oldal a Balatonon; a humán-pontok éles feltérképezése, valós konverziós arányok.
