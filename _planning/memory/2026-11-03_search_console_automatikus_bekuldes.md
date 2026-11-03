# 2026-11-03 — Search Console: automatikus beküldés (SUB a „portál-jutalék + megtalálhatóság” szál alatt)

Brief: `~/rc-briefs/search-console-bekuldes-20261103.md` · Döntés: ADR-0415 (`_planning/decisions/XXXX-search-console-automatikus-bekuldes.md`) · ⛔ ÉLESEN NINCS.

## Mi készült
- `src/visibility/googleSearchConsole.ts` — Google-kliens service accounttal (JWT node:crypto-val, külső könyvtár nélkül): getToken, webResource.insert, sites.add, sites.get, sitemaps.submit; + felvevő mock.
- `src/visibility/searchConsoleTick.ts` — egyeztető futás: élő oldalak → `search_console_target`; slug-cím az oldal élesedésekor, saját domain a domain élesedésekor (TXT → ellenőrzés → sites.add → beküldés), a slug-sor kivezetése, újraküldés változott sitemapnél, visszalépés, 5 hiba után 1 levél.
- `scripts/search-console-tick.mts` (időzítő futtatója; csak éles hoszt hív Google-t) · `scripts/search-console-setup.mts` (citoviso.com egyszeri beállítása: status | add-txt [--go] | verify).
- `migrations/0119_search_console.sql` (3 tábla: property, target, event) · `src/db/schema.ts`.
- `src/domains/dns/*` — `ensureApexTxt` (Websupport: csak HOZZÁAD TXT-t, az SPF-et nem érinti; mock; Cloudflare-stub).
- `deploy/systemd/citoviso-search-console.{service,timer}` (15 perc, prod) + `targets.json`.
- Őr: `scripts/search-console-check.mts` (saját scratch-DB, 30 állítás, szabotázzsal pirosra megy), pre-commit bekötve.
- `src/config.ts`: `SEARCH_CONSOLE_KEY_FILE`, `SEARCH_CONSOLE_PLATFORM_PROPERTY`, `SEARCH_CONSOLE_OWNER_EMAILS`.

## Mérve / megcsinálva gépből (2026-11-03)
- Google Cloud `mineralcrm`: `searchconsole.googleapis.com` + `siteverification.googleapis.com` BEKAPCSOLVA; service account
  `citoviso-search-console@mineralcrm.iam.gserviceaccount.com` LÉTREHOZVA; kulcs: dev `~/.config/citoviso/search-console-sa.json` (600).
- Élő próba (csak olvasás): a service account tokent kap, a Site Verification `getToken` a citoviso.com-ra 200 + token.
- Lokális próba (mock Google, valódi helyi publikus szerver): 14 dev-oldal sitemapje beküldve; második futás 0 újraküldés.

## Ami a tulajtól kell — VÁLASZTANI KELL A és B közül
**A) Gépi út (javasolt, a tulajnak Google-ben nincs dolga):** engedély egy TXT-rekordra a citoviso.com Cloudflare-zónájában
(éles DNS, csak hozzáadás, semmit nem módosít). Utána a VPS-en: `search-console-setup.mts add-txt --go`, pár perc, `verify`.
Ez egyben MÉRI, hogy a service account maga ellenőrizhet-e domaint — erre épül a saját domainek gépi ellenőrzése.
A tulaj a Search Console-ban akkor látja a tulajdont, ha a címe a `SEARCH_CONSOLE_OWNER_EMAILS`-ben van (társtulajdonos).

**B) Kézi út (ha a tulaj maga akarja):**
1. Nyisd meg: https://search.google.com/search-console — lépj be a Google-fiókoddal.
2. Bal felül a tulajdon-választó → „Tulajdon hozzáadása” (Add property).
3. A bal oldali, **„Domain”** feliratú dobozba írd: `citoviso.com` → Folytatás.
4. A Google egy sort mutat, ami így kezdődik: `google-site-verification=` → „Másolás”. Az ablakot hagyd nyitva.
5. Új fülön: https://dash.cloudflare.com → citoviso.com → bal oldalt „DNS” → „Records” → „Add record”.
   Type: **TXT** · Name: **@** · Content: a bemásolt sor → „Save”. (A meglévő rekordokhoz ne nyúlj.)
6. Vissza a Search Console fülre → „Ellenőrzés” (Verify). Ha azt írja, nem találja: várj 5–10 percet, és nyomd újra.
7. Ha kész: bal lent „Beállítások” → „Felhasználók és engedélyek” → „Tulajdonosok kezelése” (Manage property owners) →
   „Tulajdonos hozzáadása” (Add an owner) → írd be: `citoviso-search-console@mineralcrm.iam.gserviceaccount.com` → Folytatás.
8. Szólj a koordinátornak: a VPS-en a `verify` ezt felismeri („B út”), és indul a beküldés.
(A felületi feliratok a Google magyar fordításától kicsit eltérhetnek — a zárójeles angol a biztos.)

## Ami az élesítéshez kell (mind engedélyköteles, §0)
1. Deploy egy ezt tartalmazó commitra (`deploy-prod.sh`): a 0119 migráció lefut, a GATE 6 telepíti és indítja a `citoviso-search-console.timer`-t.
   A kulcs nélkül az időzítő csak „beállításra vár” sort ír — ártalmatlan.
2. A kulcs a VPS-re: `/opt/citoviso/.config/citoviso/search-console-sa.json` (tulaj: citoviso, 600) — a forrás a dev `~/.config/citoviso/search-console-sa.json`.
3. Opcionális `.env`: `SEARCH_CONSOLE_OWNER_EMAILS=<a tulaj Google-fiókja>` (hogy a saját domainek tulajdona a tulaj Search Console-jában is látszódjon).
4. Az A vagy a B út, majd a VPS-en `npx tsx scripts/search-console-setup.mts verify`.
5. Ellenőrzés: `journalctl -u citoviso-search-console` + `select action, ok, http_status, detail from search_console_event order by id desc limit 20`.

## Nyitott
- ⚠️ Dokumentálatlan: a service account maga ellenőrizhet-e Domain-tulajdont (az A út vagy az első saját domain méri). Ha nem: saját domainnél
  a napló `verify` hibát mutat, a 5. után levél jön; tartalékút külön döntés.
- 1000 tulajdon / fiók plafon (minden saját domain egy tulajdon) — messze van, de a 1000. előtt dönteni kell.
- Konzol-kijelzés nincs (nem kérte a brief); ha kell, §2b terv-kapuval.
