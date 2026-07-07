# 2026-07-07 — Presence-detektálás: „tényleg nincs honlapja?" verifikáció

## A felismerés (kritikus rés)
A scraper eddig CSAK a Google Maps `websiteUri` hiányából következtette, hogy egy leadnek nincs
saját honlapja. **Ez nem bizonyíték** — csak azt jelenti, hogy a Maps-profilhoz nincs honlap kötve.
A tulaj üzemeltethet honlapot anélkül, hogy a Maps-hez kötné. → Hamis „nincs honlap" leadek.

## Külső táj (2026, kikutatva)
- **Bing Web Search API: HALOTT** (Microsoft 2025-08-11-én lekapcsolta az összeset).
- **Google Programmable Search „entire web": kivezetés alatt** — új PSE már nem kaphatja meg,
  a meglévők 2027-01-01-ig élnek. A jelenlegi `webSearch.ts` (Google CSE) tehát visszaszámlálón van.
- Reális pótlás a search-farokra: **Brave Search API** (független index, olcsó), SerpAPI, Tavily/Exa.

## A megoldás: presence ≠ search
„Van-e honlapja" eldöntéséhez nem kell a fél webet átfésülni. Rétegelt, olcsó-először tölcsér:
Maps `websiteUri` → **domain-guess + geo-verifikált HTTP-proba (0 API-költség)** → FB/portál →
fizetős search CSAK a maradékra.

## ⚠️ VÉRREL TANULT szabály (a session leglényege)
Badacsonyi teszten a naiv domain-guess **4/8 „találata" MIND hamis pozitív volt**:
Rózsakő ház/Badacsony → Rózsakő **Étterem/Kisvárda**; Piroska Ház → idősotthon **Bük**;
Fortuna vendégház → szállás **Kiskunhalas**; Centrum Panzió → **parkolt** („ELADÓ"). Egyik sem az
adott cég. → **Talált honlap CSAK geo/kontextus-egyezéssel érvényes; brand-only = COLLISION,
elvetendő.** Geo-verifikáció nélküli presence-check TILOS élesíteni (jó leadet dobna el). Ez az
A4 konfidencia-kapu tükre a presence-rétegben → `_planning/DOMAIN/03-INVARIANTS.md` §F (13–16).

## Leszállított kód
- `src/scraper/enrichPresence.ts` (ÚJ): none/portal_only leadekre domain-guess (név ± típusszó ±
  régió, `.hu`/`.com`, www) → HTTP-proba → geo-szigorú verifikáció (márka-mag ÉS régió KÖTELEZŐ,
  parkolt-oldal kiszűrve). Talált → `has_own`. 0 külső API.
- `src/scraper/run.ts`: bekötve `enrichPlaces` → **enrichPresence** → `enrichOutdated` közé + metrika.
- Diagnosztika: `_planning/_tools/presence-probe.mjs`, `_planning/_tools/presence-check.mts`.
- Validálva: `tsc --noEmit` tiszta; a 42 badacsonyi leaden 0 hamis pozitív (a 8 „nincs honlap" valós).

## Korlát + következő lépés
A guess csak azt fogja meg, aminek **cégnév = domain**. Fantázianeves domainhez kell a **web-search
a farokra** → **Brave backend** a `webSearch.ts` mögé, majd search-alapú presence-tail. Ez a
következő szelet. Kapcsolódó nyitott rés: [[project_a4_confidence_gap_contextual]] (kontextuális AI a
medium sávra) — a presence-verifikáció ugyanannak a bizalmi magnak a része.
