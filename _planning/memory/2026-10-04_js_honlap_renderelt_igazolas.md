# 2026-10-04 — A JS-sel épülő saját honlap is igazolható (Dalma panzió)

Session: `citb4fcc361`. Commit: `c9bd29a9` (land: IGAZOLTAN FENT, `origin/main=1e63d910`). Élesre: csak a nagy deployjal.

## Bejelentés
Tulaj: „Dalma panzió” / Balatonvilágos — a konzol „nincs honlap”-ot mutat (honlapként a Maps-ből jött
`turistautak.hu/poi.php`, ami portál), holott a `dalmapanzio.hu` él. „Nem működik a brave?”

## Ok (mérve)
- A Brave MŰKÖDIK: a `Dalma panzió Balatonvilágos hivatalos oldal` lekérdezésre az 1. találat `www.dalmapanzio.hu/hu/`;
  a domain-tipp (`enrichPresence`) is eltalálja.
- A `verify()` dobta el: márka ÉS település kell a lapon (§F.14). Az oldal previoweb.app-os, JS-sel épül — a nyers
  HTML-ben csak a `<title>Főoldal | Dalma Panzió</title>` van; „Balatonvilágos” csak a renderelt DOM-ban („…panzió,
  Balatonvilágoson”). Minden JS-motoros honlapú lead így esett ki.

## Javítás
- `src/scraper/enrichPresence.ts`: `renderHtml()` (headless Chromium, saját bot-UA `PORTAL_USER_AGENT`, URL-enként
  gyorsítótárazva) + `verifyOrRender()`: ha a nyers HTML-ben megvan a márka, de a hely nincs → renderel és ugyanazzal
  a márka+hely szabállyal ellenőriz. Márka nélküli lap sosem renderelődik (költség).
- `probeLead()` (domain-tipp) és `findOwnSite()` (`src/scraper/enrichSiteSearch.ts`, Brave-ág) ezt hívja → a konzol
  „Újragyűjtés” is.
- Ellenőrizve: mindkét út megtalálja; ugyanaz a márka rossz várossal (Kisvárda) → elutasítva; `geo-verify-check` zöld.
- Első commit-kísérlet: a `shot-user-agent-check` jogosan bukott (alap HeadlessChrome UA) → bot-UA-ra javítva.

## Nyitott
- Élesen a régi kód fut, amíg a nagy deploy ki nem megy. Utána: none/portal_only leadek újragyűjtése, hány JS-es
  honlapú lead minősül át (DB-lekérdezés még nem készült).
- 2026-10-04 reggel a gyökér-lemez 100%-on állt (22 MB); a fő tétel más fák `elek/` mappái (14 + 6,9 + 3,7 GB).
  Közben valaki felszabadította (24 GB szabad) — a felhalmozódás oka nincs kivizsgálva.
