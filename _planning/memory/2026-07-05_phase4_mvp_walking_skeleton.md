# Fázis 4 — Vertikális MVP („walking skeleton") — 🔄 FOLYAMATBAN

Dátum: 2026-07-05
Típus: tervezés (Fázis 4, lásd `_planning/ROADMAP.md`)
Státusz: 4a ✅ · 4b ✅ · 4c-i ✅ · 4c-ii vázlat (1 nyitott döntés) · 4d hátra
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

**NYITOTT DÖNTÉS — fizetés-scope az MVP-ben (javaslat, jóváhagyásra vár):**
- Tenant→Citoviso (élesítés = 1. fizetős kapu): ✅ KELL (a siker-kritérium ezen áll).
- Vendég→Tulaj (foglalási előleg): javaslat = HALASZTJUK → a foglalás egyelőre fizetés nélküli kérés (request→visszaigazolás).

## Hátralévő
- 4c-ii fizetés-döntés jóváhagyása.
- **4d — konkrét megvalósítási/stack döntések** (keretrendszer, DB, hosting, agent-platform) — itt már technikai, tulaj jóváhagyásával. Ezzel zárul a Fázis 4.
