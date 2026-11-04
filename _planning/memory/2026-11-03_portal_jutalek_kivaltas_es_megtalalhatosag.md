# 2026-11-03 — Portál-jutalék kiváltása + megtalálhatóság (tulaj-szál, koordinátor)

Brief: `~/rc-briefs/portal-jutalek-kivaltas-lathatosag-20261102.md` · Döntés: ADR-0416 (+ a SUB ADR-0415-je) · Kiváltó: Marilyn Vendégház (Kehidakustány, lead `56650b07`) próbázni akar; neki és ismerőseinek két dolog számít: portál-jutalék nélkül, és hogy megtalálják.

## Elvégezve
- **Jutalék-számok forrással** (`_planning/DOMAIN/01-CALC-MODELS.md`): a forrás nélküli „0,15–0,18” és „20–30%” helyett OGY Infojegyzet 2024/1 (10–30%), Szallas.hu 13% egy 2019-es esetben (adozona.hu), Booking-átlag nincs. Booking DMA-kapuőr 2024-11-14 óta → EGT-ben nincs ár-paritás; Szallas.hu szerződése nem ellenőrzött.
- **SEO élőben mérve** (Sáma): index, canonical, LodgingBusiness JSON-LD, robots + sitemap rendben; hiányzott a Search Console-beküldés, vékony a meta-leírás.
- **Search Console (SUB cit0d14366e, ADR-0415) ÉLES:** deploy `7c803b52` (prod/20261103-1657). Kulcs a VPS-en: `/opt/citoviso/.config/citoviso/search-console-sa.json` (600). Cloudflare TXT felvéve, `sc-domain:citoviso.com` ellenőrizve. 6 sitemap beküldve (3 slug + 3 saját domain), hiba 0. Időzítő: `citoviso-search-console.timer`, 15 percenként.
- A deploy vitte a másik szál belépés-emlékeztetőjét (ADR-0417) is — a tulaj kifejezetten jóváhagyta („A) mehet”).
- **Mock-kör (SUB cit8ed5cacc), döntésre vár:** „Közvetlen foglalás előnye” (vendég A/B/C, beállítás 1/2, rendelő-panel; 490 Ft/hó és Teljes-csomag csak javaslat) + Google Térkép-útmutató helye (1 Áttekintés-kártya / 2 Teendők sor / 3 Webcím oldal + sáv) + KB-vázlat (`admin-get-found`). A mockok a fán kívül megőrizve: `~/rc-briefs/_mocks/portal-20261103/`.
- KB: Bizonylatok + partner-lap súgó a rendszer-számlákról (tudasbazis-or PASS), friss kb-shot kép.

## Tulaj-döntések (ADR-0416)
- GBP-útmutató: kell. GBP-profilkezelés: később, konkrét tenanttal. Jutalék-kalkulátor: nem kell.
- Közvetlen-előny: külön megvehető modul, csomagba is tehető, stratégiánként választható szövegek; ígéret csak betartva/vállalva.
- Közösségi média: poszt-generáló modul, a Programok modullal összekötve; a tulaj valójában célzott hirdetésre gondol.
- Alaptézis: a vendég portálon választ, majd a névre keresve közvetlen, jobb ajánlatot keres.

## Nyitott (a tulajé)
1. Közvetlen-előny mock-választás + ár + Teljes-csomag.
2. Térkép-útmutató helye (1/2/3).
3. Célzott hirdetés: ki fizeti a keretet, kinek a fiókja, retargeting igen/nem.
4. Ajánlói csatorna (Marilyn ismerősei) — nem válaszolt.

Jóváhagyás után: terv befagyasztása `assets/design-refs/console/…`, modul-implementáció, KB-entry a Térkép-útmutatóhoz.

## Módosított fájlok (ez a szál)
- `_planning/DOMAIN/01-CALC-MODELS.md`
- `_planning/decisions/0416-portal-jutalek-kivaltasa-es-megtalalhatosag.md`
- `MEMORY.md`
- `kb/entries/console-documents/entry.hu.md`, `kb/entries/console-documents/assets/hu/screen.png`
- `kb/entries/console-partner-page/entry.hu.md`
